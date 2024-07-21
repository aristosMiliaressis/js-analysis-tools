
function unhar() {
    har_file=$1
    origin_domain="${1%.har}"
    apex_domain=$(echo $origin_domain | unfurl apexes)
    tmp_file=`mktemp`
    mkdir $origin_domain 2>/dev/null

    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' > $tmp_file

    while read url
    do
        domain=$(echo "$url" | unfurl format %d)
        apex=$(echo $domain | unfurl apexes)
        if [[ $apex != $apex_domain ]];	then continue; fi

        query=$(echo "$url" | unfurl format %q)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="$origin_domain/${domain}${path}/$(echo $filename | head -c 253)"
        mkdir -p "$origin_domain/${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]
        then
            file=$(echo "$path" | rev | cut -d / -f 1 | rev | tail -c 249).html
            path=$(echo "$path" | rev | cut -d / -f 2- | rev)
        fi
        cat $tmp_file | jq -c 'select( .request.url == "'$url'")' \
            | head -n 1 \
            | jq -r '.response.content.text' > "$filename"
        echo "domain: $domain path: $path file: $filename"
        if [[ -d "$filename" ]]; then continue; fi
        if [[ $(file -- "$filename") == *"JavaScript source"* || "$file" == *".js" ]]
        then
            (
                deobfuscator.js "$filename"
                if [[ $? -ne 0 ]]
                then
                    js-beautify --outfile="$filename" "$filename"
                fi
            ) &
        elif [[ $(file -- "$filename") == *"HTML document"* || "$file" == *".html" ]]
        then
            html-beautify --outfile="$filename" "$filename"
        fi
    done <<< $(cat $tmp_file | jq -r '.request.url' | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
}

function srcmap() {
    domain="${1%.har}"
    mkdir src 2>/dev/null
	
    cat $1 | jq -r '.log.entries[] | select(._resourceType == "script") | .request.url' \
        | grep "$domain/" \
        | sort -u \
        | parallel -j+0 sourcemapper --output src -jsurl {}
	
    codeql database create codeql -s $domain --language=javascript
    codeql database analyze codeql javascript-lgtm.qls --format=sarif-latest --output=results.sarif
}

function capture_har() {
    url=$1
    domain=$(echo $url | unfurl format %d)
    
    google-chrome --remote-debugging-port=9222 --headless &
    chrome_pid=$!
    
    chrome-har-capturer -i -c -g 5000 -t "127.0.0.1" -p 9222 -o ${domain}.har $url
    kill $chrome_pid
    
    if [[ -d $domain ]]
    then
        rm -rf $domain/*
        unhar ${domain}.har
        cd $domain
    else
        unhar ${domain}.har
        cd $domain
        git init
    fi
    git add .
    git commit -m "$(date +%s)"
    cd ..
    rm ${domain}.har
}

function fetch_urls() {
    tmp=`mktemp`
    trap "rm $tmp" EXIT

    while read url
    do
        echo $url
    done | tr -d '\r' | unfurl format %s://%a%p > $tmp

    while read url
    do
        query=$(echo "$url" | unfurl format %q)
        domain=$(echo "$url" | unfurl format %d)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="${domain}${path}/$(echo $filename | head -c 253)"
        mkdir -p "${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]
        then
            file=$(echo "$path" | rev | cut -d / -f 1 | rev | tail -c 249).html
            path=$(echo "$path" | rev | cut -d / -f 2- | rev)
        fi
        
        if [[ -d "$filename" ]]; then continue; fi
        
        curl --compressed -H 'User-Agent: Mozilla/5.1' "$url" > "$filename"
        
        if [[ $(file -- "$filename") == *"JavaScript source"* || "$file" == *".js" ]]
        then
            (
                deobfuscator.js "$filename"
                if [[ $? -ne 0 ]]
                then
                    js-beautify --outfile="$filename" "$filename"
                fi
            ) &
        elif [[ $(file -- "$filename") == *"HTML document"* || "$file" == *".html" ]]
        then
            html-beautify --outfile="$filename" "$filename"
        fi
    done <<< $(cat $tmp | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
}
