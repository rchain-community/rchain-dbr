<?php
class tables_github_users {
	function getTitle(&$record){
		return $record->val('name').' '.$record->val('login');
	}
	function avatarUrl__htmlValue(&$record){
		return '<img src="'.$record->val('avatarUrl').'" alt="'.$record->val('login').' width="44" height="44"/>';
	}

	function location__htmlValue(&$record){
		return '<a href="https://en.wikipedia.org/wiki/'.htmlspecialchars($record->val('location')).'" >'.$record->val('location').'</a>';
	}
}
?>