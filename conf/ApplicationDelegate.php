<?php
/**
 * A delegate class for the entire application to handle custom handling of 
 * some functions such as permissions and preferences.
 */
class conf_ApplicationDelegate {
    /**
     * Returns permissions array.  This method is called every time an action is 
     * performed to make sure that the user has permission to perform the action.
     * @param record A Dataface_Record object (may be null) against which we check
     *               permissions.
     * @see Dataface_PermissionsTool
     * @see Dataface_AuthenticationTool
     */
     function getPermissions(&$record){
         $auth =& Dataface_AuthenticationTool::getInstance();
         $user =& $auth->getLoggedInUser();

         if ( !isset($user) ) return Dataface_PermissionsTool::READ_ONLY();

         $role = $user->val('permission');

         // map github-speak to xataface-speak
         // ISSUE: why doesn't permissions.ini EXTENDS work?
         // cf. http://xataface.com/wiki/permissions.ini_file
         if ($role == 'WRITE') {
             $role = 'DELETE';
         }

         // TODO: more managers
         if ($user->val('login') == 'dckc') {
             $role = 'MANAGER';
         }

         return Dataface_PermissionsTool::getRolePermissions($role);
             // Returns all of the permissions for the user's current role.
      }

    public function beforeHandleRequest(){
        Dataface_Application::getInstance()
            ->addHeadContent(
                sprintf('<link rel="stylesheet" type="text/css" href="%s"/>',
                        htmlspecialchars(DATAFACE_SITE_URL.'/rchain-style.css')
                )
            );
    }

}
?>
