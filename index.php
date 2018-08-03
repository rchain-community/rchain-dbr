<?php
// Reports all errors
// error_reporting(E_ALL);
// Do not display errors for the end-users (security issue)
ini_set('display_errors','Off');
// Set a logging file
ini_set('error_log','/tmp/php_errors.log');

// Override the default error handler behavior
set_exception_handler(function($exception) {
   error_log($exception);
   print("Oops. Technical difficulties. This might be harmless, or you may have hit a bug. If your vote / edit didn't get recorded, see <a href='https://github.com/rchain/bounties/wiki/VotingTrouble'>VotingTrouble</a> in the wiki.");
   exit();
});


$_SERVER['SERVER_PORT'] = 443; // KLUDGE!


$ini_array = parse_ini_file("conf.ini");

// Include the Xataface API
require_once $ini_array['xataface_location'];
  
// Include custom code
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/lib/xataface_functions.php';
require __DIR__ . '/lib/discordHelperClass.php';
require __DIR__ . '/lib/discordOauthClass.php';
require __DIR__ . '/lib/discordOauthFunctions.php';

#Check to see if we need to redirect to redirect to discord oauth before headers sent
#had to use this janky workaround because the action.ini file doesnt let me execute arbitrary php to determine the correct url.
if(checkForDiscordRedirect())
{
	$auth_url = getDiscordAuthUrl();
    header('Location: ' . $auth_url);
}


/**
 * ref Changing the Default Sort Order
 *  http://xataface.com/documentation/how-to/list_tab
 */
function defaultSort($table, $order) {
    if ( !isset($_REQUEST['-sort']) and @$_REQUEST['-table'] == $table ){
        $_REQUEST['-sort'] = $_GET['-sort'] = $order;
    }
}

defaultSort('issue', 'num desc');

// Initialize Xataface framework
df_init(__FILE__, 'xataface-2.1.3')->display();
    // first parameter is always the same (path to the current script)
    // 2nd parameter is relative URL to xataface directory (used for CSS files and javascripts)
