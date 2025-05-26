function unhar() {
    har_file=$1
    origin_domain="${1%.har}"
    apex_domain=$(echo $origin_domain | unfurl apexes)
    tmp_file=$(mktemp)
    mkdir $origin_domain 2>/dev/null

    echo $tmp_file
    cat $har_file | jq '.log.entries[] | select(._resourceType == "script" or ._resourceType == "document") | select(.response.content.text != null)' >$tmp_file

    while read url || [ -n "$url" ]; do
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

    while read url || [ -n "$url" ]; do
        sourcemapper --output src -jsurl "$url";
        if [[ $? -eq 1 ]]; then
            sourcemapper --output src -url "${url}.map";
            [[ $? -eq 1 ]] && sourcemapper --output src -url "${url%.js}.map.js";
        fi;
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

function fetch_js() {
    tmp="$(mktemp).html"
    tmp2="$(mktemp).har"
    trap "rm $tmp $tmp2" EXIT

    while read url || [ -n "$url" ]; do
        echo $url | tr -d '\r' | unfurl format %s://%a%p | awk '{print "<script src=\"" $0 "\"></script>"}' >$tmp
        stealthy-har-capturer -A '--headless' -t 10000 -o $tmp2 file://$tmp
        unhar $tmp2
    done
}

function webcrap() {
	dir="$1"
	for file in $(find "$dir" -type f -name '*.js'); do
		webcrack "$file" | sponge "$file"
	done
}

# generates wbhook url for use with postMessage-tracker/dom-tracker and extracts messages with appropriate file structure
function logMsg() {
	set -m
	tmp=`mktemp`

	( while true; do
		sleep 1
		echo > $tmp
		mv .webhook.log $tmp 2>/dev/null
		cat $tmp | jq -r 'select(.message != null) | .message' | anew -q messagelog.txt
		cat $tmp | jq -c 'select(.listener != null)' |
			while read -r msg; do
				href=$(echo "$msg" | jq -r .parent_url | sed 's,\%,%%,g')
				hops=$(echo "$msg" | jq -r .hops | sed 's,\%,%%,g')
				stack=$(echo "$msg" | jq -r .stack | sed 's,\%,%%,g')
				listener=$(echo "$msg" | jq -r .listener | sed 's,\%,%%,g')
				printf "$href\n\`$hops\` \`$stack\`\n\`\`\`javascript\n$listener\n\`\`\`\n"
			done | anew -q message_listeners.md
		cat $tmp |
			jq -c 'select(.iframes != null) | .frames[]' |
			while read -r msg; do
				html=$(echo "$msg" | jq -r .frame | sed 's,\%,%%,g')
				domPath=$(echo "$msg" | jq -r .path | sed 's,\%,%%,g')
				href=$(echo "$msg" | jq -r .url.href | sed 's,\%,%%,g')
				printf "$href\n\n\`$domPath\`\n\`\`\`html\n$html\n\`\`\`\n"
			done | anew -q iframes.md

		cat $tmp |
			jq -c 'select(.dom != null)' |
			while read -r msg; do
				dom=$(echo "$msg" | jq -r .dom)
				location=$(echo "$msg" | jq -r .location)
				domain=$(echo "$location" | unfurl domains)
				path=$(echo "$location" | unfurl path | sed 's,/$,,')
				path="./$domain$path"
				basePath=$(echo "$path" | rev | cut -d / -f 2- | rev)
				mkdir -p "$basePath" 2>/dev/null
				if [[ -d "$path" ]]; then path="$path/index.html"; fi
				echo "$dom" > "$path"
				cat "$path" | htmlq -t 'script:not([src])' > "${path}.inline.js"
			done

		cat $tmp |
			jq -c 'select(.localStorage != null)' |
			while read -r msg; do
				storage=$(echo "$msg" | jq -r .localStorage | sed 's,\%,%%,g')
				location=$(echo "$msg" | jq -r .location | sed 's,\%,%%,g')
				echo "$location"$(printf "\t")"$(echo $storage | jq -c)" | anew -q localStorage.tsv
			done

		cat $tmp |
			jq -c 'select(.sessionStorage != null)' |
			while read -r msg; do
				storage=$(echo "$msg" | jq -r .sessionStorage | sed 's,\%,%%,g')
				location=$(echo "$msg" | jq -r .location | sed 's,\%,%%,g')
				echo "$location"$(printf "\t")"$(echo $storage | jq -c)" | anew -q sessionStorage.tsv
			done

		cat $tmp |
			jq -c 'select(.cookies != null)' |
			while read -r msg; do
				storage=$(echo "$msg" | jq -r .cookies | sed 's,\%,%%,g')
				location=$(echo "$msg" | jq -r .location | sed 's,\%,%%,g')
				echo "$location"$(printf "\t")"$storage" | anew -q cookies.tsv
			done

		cat $tmp |
			jq -c 'select(.ext == "domlogger++")' |
			anew -q domlogger.json
	done ) &

	webhook_listener.py &
	trap "rm $tmp ; pkill -P $$" INT EXIT

	wait
}
