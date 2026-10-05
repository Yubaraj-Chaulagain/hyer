<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/config.php';

function out($data, $status=200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$token = trim($config['token'] ?? '');
if ($token === '' || strpos($token, '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') !== false) {
    out(['ok'=>false,'message'=>'Server configuration error: GitHub token राखिएको छैन।'], 500);
}

$owner = $config['owner'];
$repo  = $config['repo'];
$folder = trim($config['folder'], '/') . '/';

function gh($method, $path='', $body=null) {
    global $token, $owner, $repo;
    $url = "https://api.github.com/repos/".rawurlencode($owner)."/".rawurlencode($repo).$path;

    $ch = curl_init($url);
    $headers = [
        'Accept: application/vnd.github+json',
        'Authorization: Bearer '.$token,
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: Zip-Stroge-Server'
    ];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120
    ]);
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        out(['ok'=>false,'message'=>'Server GitHub connection error: '.$err], 502);
    }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);

    if ($code < 200 || $code >= 300) {
        $msg = is_array($data) && isset($data['message']) ? $data['message'] : $raw;
        out(['ok'=>false,'message'=>"GitHub $code: ".$msg], $code);
    }
    return $data;
}

function clean_name($name) {
    $name = basename($name);
    if ($name === '' || !preg_match('/^[A-Za-z0-9._-]+\.zip$/i', $name)) {
        out(['ok'=>false,'message'=>'Invalid ZIP filename.'], 400);
    }
    return $name;
}

function get_file($path) {
    try {
        return gh('GET','/contents/'.implode('/',array_map('rawurlencode',explode('/',$path))));
    } catch (Throwable $e) {
        return null;
    }
}

$action = $_GET['action'] ?? '';

try {
    if ($action === 'list') {
        $data = gh('GET','/contents/'.implode('/',array_map('rawurlencode',explode('/',trim($folder,'/')))));
        $arr = is_array($data) ? $data : [];
        $files = [];
        foreach ($arr as $x) {
            if (($x['type'] ?? '') === 'file' && preg_match('/\.zip$/i', $x['name'] ?? '')) {
                $files[] = [
                    'name'=>$x['name'],
                    'path'=>$x['path'],
                    'size'=>$x['size'] ?? 0,
                    'sha'=>$x['sha'] ?? '',
                    'download_url'=>$x['download_url'] ?? ''
                ];
            }
        }
        out(['ok'=>true,'files'=>$files]);
    }

    if ($action === 'upload' || $action === 'update') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['file'])) {
            out(['ok'=>false,'message'=>'ZIP file प्राप्त भएन।'],400);
        }
        $f = $_FILES['file'];
        if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            out(['ok'=>false,'message'=>'Upload error code: '.($f['error'] ?? -1)],400);
        }
        $name = clean_name($f['name']);
        $content = file_get_contents($f['tmp_name']);
        if ($content === false) out(['ok'=>false,'message'=>'Uploaded file पढ्न सकिएन।'],400);

        $newPath = $folder.$name;
        $body = [
            'message' => ($action==='update'?'Update ':'Add ').$name,
            'content' => base64_encode($content)
        ];

        if ($action === 'upload') {
            // Prevent accidental overwrite.
            try {
                gh('GET','/contents/'.implode('/',array_map('rawurlencode',explode('/',$newPath))));
                out(['ok'=>false,'message'=>'यही नामको ZIP पहिले नै छ; Update प्रयोग गर्नुहोस्।'],409);
            } catch (Throwable $e) {
                // 404 is expected; continue.
            }
        } else {
            $oldPath = $_POST['old_path'] ?? '';
            $oldSha = $_POST['old_sha'] ?? '';
            if ($oldPath === '' || $oldSha === '') out(['ok'=>false,'message'=>'Update information missing.'],400);

            if ($newPath === $oldPath) {
                $body['sha'] = $oldSha;
            } else {
                // If a different filename is chosen, create the new file first,
                // then delete the old one.
                $existing = null;
                try { $existing = gh('GET','/contents/'.implode('/',array_map('rawurlencode',explode('/',$newPath)))); }
                catch (Throwable $e) {}
                if ($existing) $body['sha'] = $existing['sha'];

                gh('PUT','/contents/'.implode('/',array_map('rawurlencode',explode('/',$newPath))),$body);

                gh('DELETE','/contents/'.implode('/',array_map('rawurlencode',explode('/',$oldPath))),[
                    'message'=>'Delete old ZIP '.basename($oldPath),
                    'sha'=>$oldSha
                ]);
                out(['ok'=>true,'message'=>'Update सफल']);
            }
        }

        gh('PUT','/contents/'.implode('/',array_map('rawurlencode',explode('/',$newPath))),$body);
        out(['ok'=>true,'message'=>($action==='update'?'Update सफल':'Upload सफल')]);
    }

    if ($action === 'delete') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok'=>false,'message'=>'POST required'],405);
        $path = $_POST['path'] ?? '';
        $sha = $_POST['sha'] ?? '';
        if ($path === '' || $sha === '') out(['ok'=>false,'message'=>'Delete information missing.'],400);
        if (strpos($path,$folder) !== 0 || !preg_match('/\.zip$/i',$path)) {
            out(['ok'=>false,'message'=>'Invalid file path.'],400);
        }
        gh('DELETE','/contents/'.implode('/',array_map('rawurlencode',explode('/',$path))),[
            'message'=>'Delete ZIP '.basename($path),
            'sha'=>$sha
        ]);
        out(['ok'=>true,'message'=>'Deleted']);
    }

    out(['ok'=>false,'message'=>'Unknown action.'],400);

} catch (Throwable $e) {
    out(['ok'=>false,'message'=>'Server error: '.$e->getMessage()],500);
}
?>
