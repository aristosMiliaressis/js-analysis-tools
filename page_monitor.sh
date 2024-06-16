#!/bin/bash
set -x

PATH="$PATH:/usr/local/bin:/usr/local/go/bin:/usr/lib/python3.10/bin"
NOTIFY_CONFIG='/opt/tools/notify-config.yaml'
USER_AGENT='Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36'

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
    
    chrome-har-capturer -A "$USER_AGENT" -i -c -u 10000 -r 3 -e 3000 -g 4000 -t "127.0.0.1" -p 9222 -o ${normalized_url}.har $base_url
    
    if [[ -d $normalized_url ]]
    then
        prev_md5=$(find $normalized_url -type f \
            | grep -P "$normalized_url/.*\.?$apex_domain/.*\.js" \
            | grep -v '/cdn-cgi/' \
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
        | grep -P "$normalized_url/.*\.?$apex_domain/.*\.js" \
        | grep -v '/cdn-cgi/' \
        | xargs -I % cat % \
        | md5sum \
        | cut -d ' ' -f1 \
        | tr -d '\n')

    if [[ -n "$prev_md5" && "$md5" != "$prev_md5" && "$md5" != "d41d8cd98f00b204e9800998ecf8427e" && "$prev_md5" != "d41d8cd98f00b204e9800998ecf8427e" ]]
    then 
        cd $normalized_url
        cp ../${normalized_url}.har .
        git add .
        printf "$base_url included scripts changed\n$(git status | grep -E '(modified|deleted|new file):')" | notify -bulk -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        git commit -m "$(date +%s)"
        cd ..
    fi

    page_status="$(cat ${normalized_url}.har | jq '.log.entries[] | select(._resourceType == "document" and ._initiator.type == "other" and (.response.status >= 400 or .response.status < 300)) | .response.status' | tr -d '\n')"
    page_title="\"$(cat ${normalized_url}.har | jq '.log.entries[] | select(._resourceType == "document" and ._initiator.type == "other" and (.response.status >= 400 or .response.status < 300)) | .response.content.text' | htmlq -t title | tr -d '\n')\""

    prev_entry=$(cat page_index.json | jq 'select( .Url == "'$base_url'")')
    if [[ -n $prev_entry ]]
    then
        prev_status=$(echo $prev_entry | jq -r .status)
        prev_title=$(echo $prev_entry | jq .title)
        if [[ $prev_status != $page_status && -n $prev_status && -n $page_status ]]
        then
            echo "$base_url changed status code from $prev_status to $page_status" | notify -bulk -silent -provider-config $NOTIFY_CONFIG -provider discord -id monitor
        fi
        if [[ "$prev_title" != "$page_title" && $prev_title != '""' && $page_title != '""' ]]
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

if [[ -f "monitor_trace.log" ]]
then
    mv monitor_trace.log monitor_trace.log.bak
fi

# create log file for stdout & stderr
exec > >(tee "monitor_trace.log") 2>&1

echo "Started at $(date)"

google-chrome --no-sandbox --remote-debugging-port=9222 --headless &
chrome_pid=$!

# kill all children process on exit
trap "kill -s SIGTERM $chrome_pid && kill -s SIGTERM -- -$$" EXIT

tmp_page_index=`mktemp`

cat $url_file | shuf | while read url; do check $url; done

mv page_index.json page_index.json.bak
mv $tmp_page_index page_index.json
