#!/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

class WebhookHandler(BaseHTTPRequestHandler):

    def do_POST(self):
        content_len = int(self.headers.get('content-length'))
        msg = self.rfile.read(content_len).decode()
        self.send_response(200)
        self.end_headers()

        log = open("./.webhook.log", "a")
        log.write(f"{msg}\n")
        log.close()
        return

if __name__ == '__main__':
    port=31337
    server = HTTPServer(('127.0.0.1', port), WebhookHandler)
    print(f'Starting server at http://127.0.0.1:{port}')
    server.serve_forever()