#!/bin/bash
set -x

NOTIFY_CONFIG='/opt/tools/notify-config.yaml'

function extract_har() {
    har_file=$1
    normalized_url=$2
    mkdir $normalized_url 2>/dev/null

    tmp_file=`mktemp`
    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' > $tmp_file

    while read url
    do
        domain=$(echo "$url" | unfurl format %d)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        
        mkdir -p "$normalized_url/${domain}${path}" 2>/dev/null
        
        filename="$normalized_url/${domain}${path}/$(echo $file | head -c 249)"
        if [[ -d "$filename" ]]
        then
            filename=${filename%/}.html
        fi
        
        cat $tmp_file | jq -c 'select( .request.url == "'$url'")' \
            | head -n 1 \
            | jq -r '.response.content.text' > "$filename"
        
        echo "domain: $domain path: $path file: $file"
    done <<< $(cat $tmp_file | jq -r '.request.url' | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
    rm $tmp_file
}

function check() {
    base_url=$1
    normalized_url=$(echo $base_url | tr '/' '_')
    apex_domain=$(echo $base_url | unfurl apexes)
    
    chrome-har-capturer -i -c -g 4000 -t "127.0.0.1" -p 9222 -o ${normalized_url}.har $base_url
    
    if [[ -d $normalized_url ]]
    then
        prev_md5=$(find $normalized_url -type f \
            | grep '.*\.'$apex_domain'/.*\.js$' \
            | xargs -I % cat % \
            | md5sum \
            | cut -d ' ' -f1 \
            | tr -d '\n')
        
        rm -rf $normalized_url/*
        extract_har ${normalized_url}.har $normalized_url
    else
        extract_har ${normalized_url}.har $normalized_url
        if [[ ! -d $normalized_url ]]; then return; fi
        cd $normalized_url
        git init
        git add .
        git commit -m "$(date +%s)"
        cd ..
    fi
    
    md5=$(find $normalized_url -type f \
        | grep '.*\.'$apex_domain'/.*\.js$' \
        | xargs -I % cat % \
        | md5sum \
        | cut -d ' ' -f1 \
        | tr -d '\n')

    if [[ ! -z "$prev_md5" && "$md5" != "$prev_md5" ]]
    then 
        echo "$base_url changed script_md5 from $prev_md5 to $md5" | notify -bulk -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        cd $normalized_url
        git add .
        git commit -m "$(date +%s)"
        cp ../${normalized_url}.har .
        cd ..
    fi

    page_status="$(cat ${normalized_url}.har | jq '.log.entries[] | select(._resourceType == "document" and ._initiator.type == "other" and (.response.status >= 400 or .response.status < 300)) | .response.status' | tr -d '\n')"
    page_title="\"$(cat ${normalized_url}.har | jq '.log.entries[] | select(._resourceType == "document" and ._initiator.type == "other" and (.response.status >= 400 or .response.status < 300)) | .response.content.text' | htmlq -t title)\""

    prev_entry=$(cat page_index.json | jq 'select( .Url == "'$base_url'")')
    if [[ ! -z $prev_entry ]]
    then
        prev_status=$(echo $prev_entry | jq -r .status)
        prev_title=$(echo $prev_entry | jq .title)
        if [[ $prev_status != $page_status ]]
        then
            echo "$base_url changed status code from $prev_status to $page_status" | notify -bulk -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        fi
        if [[ "$prev_title" != "$page_title" ]]
        then 
            echo "$base_url changed title from $prev_title to $page_title" | notify -bulk -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        fi
    fi
    
    echo '{"Url":"'$base_url'","title":'$page_title',"status":"'$page_status'"}' >> $tmp_page_index
    rm ${normalized_url}.har
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

google-chrome --no-sandbox --remote-debugging-port=9222 --headless &
chrome_pid=$!

# kill all children process on exit
trap "kill $chrome_pid && kill -- -$$" SIGINT SIGTERM EXIT

tmp_page_index=`mktemp`

cat $url_file | shuf | while read url; do check $url; done

mv page_index.json page_index.json.bak
mv $tmp_page_index page_index.json
