function unhar() {
    har_file=$1
    origin_domain="${1%.har}"
    apex_domain=$(echo $origin_domain | unfurl apexes)
    tmp_file=$(mktemp)
    mkdir $origin_domain 2>/dev/null

    echo $tmp_file
    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' >$tmp_file

    while read url; do
        domain=$(echo "$url" | unfurl format %d)
        apex=$(echo $domain | unfurl apexes)
        if [[ $apex != $apex_domain ]]; then continue; fi

        query=$(echo "$url" | unfurl format %q)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="$origin_domain/${domain}${path}/$(echo $filename | head -c 253)"
        mkdir -p "$origin_domain/${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]; then
            file=$(echo "$path" | rev | cut -d / -f 1 | rev | tail -c 249).html
            path=$(echo "$path" | rev | cut -d / -f 2- | rev)
        fi
        cat $tmp_file | jq -c 'select( .request.url == "'$url'")' |
            head -n 1 |
            jq -r '.response.content.text' >"$filename"
        echo "domain: $domain path: $path file: $filename"

        if [[ $(file -- "$filename") == *"HTML document"* || "$file" == *".html" ]]; then
            cat "$filename" | htmlq -t script >"$filename.js"
            rm "$filename"
            filename="$filename.js"
        fi

        if [[ $(file -- "$filename") == *"JavaScript source"* || "$file" == *".js" ]]; then
            (
                deobfuscator.js "$filename"
                if [[ $? -ne 0 ]]; then
                    js-beautify --outfile="$filename" "$filename"
                fi
            ) &
        fi
    done <<<$(cat $tmp_file | jq -r '.request.url' | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
}

function srcmap() {
    mkdir src 2>/dev/null

    while read url; do
        sourcemapper --output src -jsurl $url
    done <"${1:-/dev/stdin}"

    /opt/codeql/codeql database create codeql -s source_code --language=javascript
    /opt/codeql/codeql database analyze codeql javascript-lgtm.qls --format=sarif-latest --output=lgtm-results.sarif
    /opt/codeql/codeql query run --database=codeql --output=custom-results.sarif -- /opt/codeql/custom/*.ql
}

function capture_har() {
    url=$1
    domain=$(echo $url | unfurl format %d)

    google-chrome --remote-debugging-port=9222 --headless &
    chrome_pid=$!

    chrome-har-capturer -i -c -g 5000 -t 127.0.0.1 -p 9222 -o ${domain}.har $url
    kill $chrome_pid

    if [[ -d $domain ]]; then
        cd $domain
        git add .
        git commit -m "$(date +%s)"
    else
        rm -rf $domain/*
        unhar ${domain}.har
        cd $domain
        git init
        git add .
        git commit -m "$(date +%s)"
    fi
}

function fetch_urls() {
    tmp=$(mktemp)
    trap "rm $tmp" EXIT

    while read url; do
        echo $url
    done | tr -d '\r' | unfurl format %s://%a%p >$tmp

    while read url; do
        url=$(echo $url | tr -d '\r')
        query=$(echo "$url" | unfurl format %q)
        domain=$(echo "$url" | unfurl format %d)
        path=$(echo "$url" | unfurl format %p | rev | cut -d / -f 2- | rev | head -c 3800)
        file=$(echo "$url" | unfurl format %p | rev | cut -d / -f 1 | rev)
        filename="${file}"
        [[ ! -z "$query" ]] && filename="$filename%3F$query"
        filename="${domain}${path}/$(echo $filename | head -c 253)"
        mkdir -p "${domain}${path}" 2>/dev/null
        if [[ -d "$filename" ]]; then
            file=$(echo "$path" | rev | cut -d / -f 1 | rev | tail -c 249).html
            path=$(echo "$path" | rev | cut -d / -f 2- | rev)
        fi

        echo "Curling $url"
        curl -s --compressed -H 'User-Agent: Mozilla/5.1' "$url" >"$filename"

        if [[ $(file -- "$filename") == *"HTML document"* || "$file" == *".html" ]]; then
            cat "$filename" | htmlq -t script >"$filename.js"
            rm "$filename"
            filename="$filename.js"
        fi

        if [[ $(file -- "$filename") == *"JavaScript source"* || "$file" == *".js" ]]; then
            (
                deobfuscator.js "$filename"
                if [[ $? -ne 0 ]]; then
                    js-beautify --outfile="$filename" "$filename"
                fi
            ) &
        fi
    done <<<$(cat $tmp | sort -u | awk '{ print length, $0 }' | sort -n -s -r | cut -d" " -f2-)
}

# generates wbhook url for use with postMessage-tracker/dom-tracker and extracts messages with appropriate file structure
function logMsg() {
	interactsh-client -json -o data.json &
	time=$(date +%s)

	while true; do
		sleep 5
		cat data.json | jq -r '."raw-request"' | grep '{"' | jq -r 'select(.message != null) | .message' | tee ${time}_messagelog.txt
		cat data.json | jq -r '."raw-request"' | grep '{"' | jq -c 'select(.listener != null)' |
			while read -r msg; do
				href=$(echo $msg | jq -r .parent_url | sed 's,\%,%%,g')
				hops=$(echo $msg | jq -r .hops | sed 's,\%,%%,g')
				stack=$(echo $msg | jq -r .stack | sed 's,\%,%%,g')
				listener=$(echo $msg | jq -r .listener | sed 's,\%,%%,g')
				printf "$href\n\`$hops\` \`$stack\`\n\`\`\`javascript\n$listener\n\`\`\`\n"
			done | tee ${time}_message_listeners.md
		cat data.json |
			jq -r '."raw-request"' |
			grep '{"' |
			jq -c 'select(.iframes != null) | .frames[]' |
			while read -r msg; do
				html=$(echo $msg | jq -r .frame | sed 's,\%,%%,g')
				domPath=$(echo $msg | jq -r .path | sed 's,\%,%%,g')
				href=$(echo $msg | jq -r .url.href | sed 's,\%,%%,g')
				printf "$href\n\n\`$domPath\`\n\`\`\`html\n$html\n\`\`\`\n"
			done | tee ${time}_iframes.md

		cat data.json |
			jq -r '."raw-request"' |
			grep '{"' |
			jq -c 'select(.dom != null)' |
			while read -r msg; do
				dom=$(echo $msg | jq -r .dom | sed 's,\%,%%,g')
				path=$(echo $msg | jq -r .path | sed 's,\%,%%,g')
				basePath=".$(echo "$path" | rev | cut -d / -f 2- | rev)"
				mkdir -p "$basePath" 2>/dev/null
				echo "$dom" > ".$path"
			done
	done
}
