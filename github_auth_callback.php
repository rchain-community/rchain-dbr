<?php
#show errors for debugging.
#ini_set('display_errors', 1);
#ini_set('display_startup_errors', 1);
#error_reporting(E_ALL);

session_start();

require __DIR__ . '/lib/xataface_functions.php';

#get config
$ini_array = parse_ini_file("conf.ini");
$client_id = $ini_array['github_app_client_id'];
$client_secret = $ini_array['github_app_client_secret'];
$url = $ini_array['github_api_url'];

#if there is no code, then they haven't been redirected here from github, so lets send them to github
if(!array_key_exists('code', $_GET) || !isset($_GET['code']))
{
	if($ini_array['github_include_email_scope'])
	{
		$auth_url = 'https://github.com/login/oauth/authorize?client_id='.$client_id.'&scope=user:email';
	}
	else
	{
		$auth_url = 'https://github.com/login/oauth/authorize?client_id='.$client_id;
	}
    header('Location: '.$auth_url);
}

$code = $_GET['code'];

$postdata = http_build_query(
    array(
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'code' => $code
    )
);
$opts = array('http' =>
    array(
        'method'  => 'POST',
        'header'  => 'Content-type: application/x-www-form-urlencoded',
        'content' => $postdata
    )
);
$context = stream_context_create($opts);
if(!$result = file_get_contents($url, false, $context))
{
    echo "failed to connect to github";
    exit();
}


#check for error:
if(strpos($result, 'error') !== false) 
{
    echo "Github responded with an error. Cannot login.";
    exit();
}

#first get all general info
$json_url = 'https://api.github.com/user?'.$result;
$options  = array('http' => array('user_agent'=> $_SERVER['HTTP_USER_AGENT']));
$context  = stream_context_create($options);
if(!$response = file_get_contents($json_url, false, $context))
{
    echo "failed to connect to github";
    exit();
}

if(strpos($response, 'error') !== false) 
{
    echo "Github responded with an error. Cannot login.";
    exit();
}

$response = json_decode($response);

#make sure the response contains what we expect:
if(!property_exists($response, 'login') || $response->login == '')
{
    echo "Github response doesn't contain expected data";
    exit();
}

$github_data = array();
$github_data['login'] = $response->login;
$github_data['name'] = $response->name;
$github_data['location'] = $response->location;
$github_data['bio'] = $response->bio;
$github_data['website_url'] = $response->blog;
$github_data['avatar_url'] = $response->avatar_url;
$github_data['created_at'] = $response->created_at;

if($ini_array['github_include_email_scope'])
{
	#next get the private email address
	$json_url = 'https://api.github.com/user/emails?'.$result;
	$options  = array('http' => array('user_agent'=> $_SERVER['HTTP_USER_AGENT']));
	$context  = stream_context_create($options);

	if(!$response = file_get_contents($json_url, false, $context))
	{
		echo "failed to connect to github";
		exit();
	}

	if(strpos($response, 'error') !== false) 
	{
		echo "Github responded with an error. Cannot login.";
		exit();
	}

	$response = json_decode($response);

	#if more than one in array, we need to go through and find the primary one.
	if(count($response) > 1)
	{
		foreach($response as $email_object)
		{
			if($email_object->primary == 1)
			{
				$github_data['email'] = $email_object->email;
			}
		}
	}
	else
	{
		$github_data['email'] = $response[0]->email;
	}
}
else
{
	$github_data['email'] = '';
}

#now the user is authorized from github, so in order to user the built in xataface session management, 
#we need to tell it to login like a normal user. So lets create a temporary password for this session,
#and store it in the database. Then we will submit the login form to xataface with the correct username
#and password for this session.

#now lets write the info to the database as a user. if it doesnt exist, write it, else just update it
$mysqli = new mysqli($ini_array['host'], $ini_array['user'], $ini_array['password'], $ini_array['name']);
if ($mysqli->connect_errno) 
{
    echo "could not connect to database";
    exit();
}
#escape everything
foreach($github_data as $key=>$val)
{
    $github_data[$key] = $mysqli->real_escape_string($val);
}


#randomly generate the temporary session token
#$session_token = md5(uniqid(rand(), true));
#this is CSPRNG. Also saved in database as md5
$session_token = getToken(40);

$sql = "INSERT into ".$ini_array['users_table']." (".$ini_array['username_column'].", ".$ini_array['password_column'].", name, location, email, bio, websiteUrl, avatarUrl, createdAt) " .
        "VALUES ('".$github_data['login']."', '".$session_token."',  '".$github_data['name']."', '".$github_data['location']."', '".$github_data['email']."', '".$github_data['bio']."', '".$github_data['website_url']."', '".$github_data['avatar_url']."', '".$github_data['created_at']."') " .
        "ON DUPLICATE KEY UPDATE ".$ini_array['username_column']."=VALUES(".$ini_array['username_column']."), ".$ini_array['password_column']."=VALUES(".$ini_array['password_column']."), name=VALUES(name), location=VALUES(location), email=VALUES(email), bio=VALUES(bio), websiteUrl=VALUES(websiteUrl), avatarUrl=VALUES(avatarUrl), createdAt=VALUES(createdAt)";
if (!$result = $mysqli->query($sql)) 
{
    echo "could not write to database";
    exit();
}

#finally, submit the usual form to xataface
?>

<form id='login_form' action="index.php" method="post" class="xataface-login-form">
    <input type="hidden" name="-action" value="login">
    <input type="hidden" name="-redirect" value="">
    <input type="hidden" name="UserName" value="<?php echo $github_data['login']; ?>">
    <input type="hidden" name="Password" value="<?php echo $session_token; ?>">
</form>

<script>
    document.getElementById("login_form").submit();
</script>