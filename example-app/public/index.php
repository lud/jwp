<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

// Instantiate App
$app = AppFactory::create();

// Add error middleware
$app->addErrorMiddleware(true, true, true);

define('JWP_USERNAME', 'dev@dev.dev');
define('JWP_PASSWORD', '$dev2020');


// Add routes
$app->get('/', function (Request $request, Response $response) {
    $jwp = new Jwp\Client(JWP_USERNAME, JWP_PASSWORD);
    $userID = uniqid();
    $connParams = json_encode($jwp->connect($userID, ['channels' =>  ['general']]));

    $html = <<<HTML
        <!DOCTYPE html>
        <title>Example App</title>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="main.css" /> 
        <div class="container">
            <h2>Chat example</h2>
            <div id="messages-list"></div>
            <input type="text" id="msg-body" value="Hello !" />
            <button id="msg-send">Send</button>
        </div>
        <script>
            window.jwpParams = $connParams;
        </script>
        <script src="jwp.js"></script>
        <script src="main.js"></script>
HTML;

    $response->getBody()->write($html);
    return $response;
});

$app->post('/chat', function (Request $request, Response $response, $args) {
    $contents = json_decode(file_get_contents('php://input'), true);
    $message = $contents['message'];
    $request =  $request->withParsedBody($contents);
    $jwp = new Jwp\Client(JWP_USERNAME, JWP_PASSWORD);
    $x = $jwp->push('general', 'chat_msg', ['message' => $message]);
    $response = $response->withHeader('Content-type', 'application/json');
    $response->getBody()->write(json_encode(['status' => 'ok']));
    return $response;
});

$app->run();