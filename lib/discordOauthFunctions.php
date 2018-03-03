<?php
	function checkForDiscordRedirect()
	{
		if(array_key_exists('redirect_to_discord_oauth', $_GET) && $_GET['redirect_to_discord_oauth'] == 'true')
		{
			return True;
		}
		return False;
	}
	
	function getDiscordAuthUrl()
	{
		$discordAuth = new discordOauthClass();
		$auth_url = $discordAuth->getAuthUrl();
		return $auth_url;
	}
?>