<?php
class tables_github_users {
	function getTitle(&$record){
        $login = $record->val('login');
        $name = $record->val('name');
        return strlen($name) > 0 ? ($name.' '.$login) : $login;
	}
	function login__htmlValue(&$record){
        $login = $record->val('login');
		return link_markup('https://github.com/'.$login, $login);
	}
	function websiteUrl__htmlValue(&$record){
        $websiteUrl = $record->val('websiteUrl');
		return strlen($websiteUrl) > 0 ? link_markup($websiteUrl, $websiteUrl) : '';
	}
	function avatarUrl__htmlValue(&$record){
        $login = $record->val('login');
        $img = '<img src="'.$record->val('avatarUrl').'" alt="'.$login.' width="44" height="44"/>';
		return link_markup('https://github.com/'.$login, $img);
	}
	function location__htmlValue(&$record){
        $location = $record->val('location');
		return link_markup('https://en.wikipedia.org/wiki/'.$location, $location);
	}
}

function link_markup($href, $content) {
		return '<a href="'.htmlspecialchars($href).'" >'.$content.'</a>';
}

?>