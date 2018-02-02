<?php
class tables_github_users {
	function getTitle(&$record){
		return $record->val('name').' '.$record->val('login');
	}
	function avatarUrl__htmlValue(&$record){
		return '<img src="'.$record->val('avatarUrl').'" alt="'.$record->val('login').' width="20" height="20"/>';
	}
}
?>