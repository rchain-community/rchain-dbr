<?php
class actions_dashboard {
    function handle(&$params){
        $status = df_get_record('admin_settings', array());
        $auth =& Dataface_AuthenticationTool::getInstance();
        $user =& $auth->getLoggedInUser();
        df_display(array(
            'current_pay_period'=> $status ? $status->strval('current_pay_period')
                                           : "MISSING ADMIN_SETTINGS",
	    'login' => $user ? $user->strval('login') : 'nobody'),
                   'dashboard.html');
    }
}
