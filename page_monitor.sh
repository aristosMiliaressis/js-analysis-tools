#!/bin/bash
set -x

NOTIFY_CONFIG='/opt/tools/notify-config.yaml'

function extract_har() {
    har_file=$1
    origin_domain="${1%.har}"
    tmp_file=`mktemp`
    trap "rm $tmp_file" EXIT
    mkdir $origin_domain 2>/dev/null

    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' > $tmp_file

    while read url
    do
        query=$(echo "$url" | unfurl format %q)
        domain=$(echo "$url" | unfurl format %d)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="$origin_domain/${domain}${path}/$(echo $filename | head -c 249)"
        mkdir -p "$origin_domain/${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]
        then
            filename=$filename.html
        fi
        cat $tmp_file | jq -c 'select( .request.url == "'$url'")' \
            | head -n 1 \
            | jq -r '.response.content.text' > "$filename"
        echo "domain: $domain path: $path file: $file"
    done <<< $(cat $tmp_file | jq -r '.request.url' | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
}

function check() {
    base_url=$1
    base_domain=$(echo $base_url | unfurl format %d)

    chrome-har-capturer -i -c -g 4000 -t "127.0.0.1" -p 9222 -o ${base_domain}.har $base_url
    
    if [[ -d $base_domain ]]
    then
        prev_md5=$(find $base_domain -type f -exec file {} \; \
            | grep "JavaScript source" \
            | cut -d ':' -f1 \
            | xargs -I % cat % \
            | md5sum \
            | cut -d ' ' -f1 \
            | tr -d '\n')
        
        rm -rf $base_domain/*
        extract_har ${base_domain}.har
        cd $base_domain
    else
        extract_har ${base_domain}.har
        if [[ ! -d $base_domain ]]; then return; fi
        cd $base_domain
        git init
        git add .
        git commit -m "$(date +%s)"
    fi
    
    md5=$(find $base_domain -type f -exec file {} \; \
        | grep "JavaScript source" \
        | cut -d ':' -f1 \
        | xargs -I % cat % \
        | md5sum \
        | cut -d ' ' -f1 \
        | tr -d '\n')

    if [[ "$md5" != "$prev_md5" ]]
    then 
        echo "$base_url changed script_md5 to $md5" | notify -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        git add .
        git commit -m "$(date +%s)"
    fi

    cd ..

    page_status=$(cat ${base_domain}.har | jq '.log.entries[] | select(._resourceType == "document" and (.response.status >= 400 or .response.status < 300)) | .response.status')
    page_title=$(cat ${base_domain}.har | jq '.log.entries[] | select(._resourceType == "document" and (.response.status >= 400 or .response.status < 300)) | .response.content.text' | htmlq -t title)

    prev_entry=$(cat page_index.json | jq 'select( .Url == "'$base_url'")')
    if [[ ! -z $prev_entry ]]
    then
        prev_status=$(echo $prev_entry | jq -r .status)
        prev_title=$(echo $prev_entry | jq -r .title)
        if [[ $prev_status != $page_status ]]
        then
            echo "$base_url changed status code from $prev_status to $page_status" | notify -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        fi
        if [[ $prev_title != $page_title ]]
        then 
            echo "$base_url changed title from '$prev_title' to '$page_title'" | notify -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        fi
    fi
    
    echo '{"Url":"'$base_url'","title":"'$page_title'","status":"'$page_status'"}' >> $tmp_page_index
    rm ${base_domain}.har
}

if [[ $# -lt 1 ]]
then
    echo "$0 <url_file> [working_directory]"
    exit 1
fi

url_file=$1
[[ $# -gt 1 ]] && working_directory=$2 || working_directory="."

mkdir -p $working_directory 2>/dev/null
cd $working_directory

# TODO try to speed it up by making chrome & extract_har work asynchronously
google-chrome --no-sandbox --remote-debugging-port=9222 --headless &
chrome_pid=$!

# kill all children process on exit
trap "kill $chrome_pid && kill -- -$$" SIGINT SIGTERM EXIT

tmp_page_index=`mktemp`

cat $url_file | shuf | while read url; do check $url; done

mv $tmp_page_index page_index.json