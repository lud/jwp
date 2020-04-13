<?php
namespace Jwp;

use GuzzleHttp\Client as Http;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\ServerException;

class Client {
    private $http;

    public function __construct($username, $password) {
        $this->http = new Http([
            'base_uri' => 'http://localhost:4000',
            'timeout'  => 2.0,
            'headers' => $this->getHeaders(),
            'auth' => [$username, $password],
        ]);
    }

    private function getHeaders() {
        return [
            'accept' => 'application/json',
            'content-type' => 'application/json',
        ];
    }


    private function post($url, $payload = []) {
        $response = $this->http->post($url, $payload);
        $body = \GuzzleHttp\json_decode($response->getBody(), true);
        if (array_key_exists('status', $body) && $body['status'] === 'ok') {
            return $body['data'] ?? null;
        } else if (array_key_exists('status', $body) && $body['status'] === 'error') {
            throw new \Exception("Remote error : ${$body['error']}");
        }
    }

    public function connect($userID, $options = []) {
        return $this->post('/api/v1/token/authorize-socket', ['body' => json_encode($options)]);
    }

    public function push($channel, $event, $payload) {
        $json = json_encode([
            'channel' => $channel,
            'event' => $event,
            'payload' => $payload,
        ]);
        return $this->post('/api/v1/push', ['body' => $json]);
    }
}