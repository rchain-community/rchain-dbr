<?php
class actions_dashboard {
    function handle(&$params){
        $status = df_get_record('admin_settings', array());
        df_display(array('current_pay_period'=>$status->strval('current_pay_period')),
                   'dashboard.html');
    }
}
