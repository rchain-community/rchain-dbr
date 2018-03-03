<?php

class discordHelperClass
{
    public function getRoleIdFromString($role_array, $role_string)
    {
        foreach($role_array as $role_object)
        {
            if(stripos($role_object->name, $role_string) !== false)
            {
                return $role_object->id;
            }
        }
        return false;
    }
    
    public function checkIfUserHasRoleId($role_array, $role_id_wanted)
    {
        $role_id_wanted = intval($role_id_wanted);
        
        foreach($role_array as $role_id)
        {
            if($role_id == $role_id_wanted)
            {
                return true;
            }
        }
        return false;
    }
    
    public function getRolesOfUser($member_array, $username, $discriminator)
    {
        $username = strval($username);
        $discriminator = strval($discriminator);
        
        foreach($member_array as $member_object)
        {
            if($member_object->user->username == $username and $member_object->user->discriminator == $discriminator)
            {
				return $member_object->roles;
            }
        }
        return false;
    }
}
?>