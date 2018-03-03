<?php
    class dataface_modules_XDB {
        function showLoginPrompt()
        {
			global $ini_array;
			if($ini_array['github_include_email_scope'])
			{
				$auth_url = 'https://github.com/login/oauth/authorize?client_id='.$ini_array['github_app_client_id'].'&scope=user:email';
			}
			else
			{
				$auth_url = 'https://github.com/login/oauth/authorize?client_id='.$ini_array['github_app_client_id'];
			}
			header('Location: '.$auth_url);
        }  
    }
?>