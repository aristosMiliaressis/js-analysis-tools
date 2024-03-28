
function unhar() {
    har_file=$(realpath $1)
    tmp_file=`mktemp`
    mkdir site 2>/dev/null

    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' > $tmp_file

    while read url
    do
        query=$(echo "$url" | unfurl format %q)
        domain=$(echo "$url" | unfurl format %d)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="site/${domain}${path}/$(echo $filename | head -c 253)"
        mkdir -p "site/${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]
        then
            file=$(echo "$path" | rev | cut -d / -f 1 | rev | tail -c 249).html
            path=$(echo "$path" | rev | cut -d / -f 2- | rev)
        fi
        cat $tmp_file | jq -c 'select( .request.url == "'$url'")' \
            | head -n 1 \
            | jq -r '.response.content.text' > "$filename"
        echo "domain: $domain path: $path file: $filename"
        if [[ $(file -- "$filename") == *"JavaScript source"* || "$file" == *".js" ]]
        then
            js-beautify --outfile="$filename" "$filename"
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