<?php
	#function that checks to see if the user has been authenticated with discord and is a coop member
	function checkIfVerifiedCoop()
	{
		global $ini_array;
		
		$auth =& Dataface_AuthenticationTool::getInstance();
		
		#will return false if the user is not logged in
		if(!$user =& $auth->getLoggedInUser())
		{
			return False;
		}

		$is_verified_coop = $user->val($ini_array['verified_coop_column']);
		
		if($is_verified_coop == 1)
		{
			return True;
		}
		else
		{
			return False;
		}
	}

?>