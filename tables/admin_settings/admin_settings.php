<?php
class tables_admin_settings {
     function getPermissions(&$record){
         $auth =& Dataface_AuthenticationTool::getInstance();
         $user =& $auth->getLoggedInUser();
         if ( !isset($user) ) return Dataface_PermissionsTool::READ_ONLY();

         // ISSUE: this is a mess!
         if ($user->val('permission') == 'ADMIN' || $user->val('login') == 'dckc') {
             return Dataface_PermissionsTool::getRolePermissions('EDIT');
         }
         return Dataface_PermissionsTool::READ_ONLY();
     }
}
?>
