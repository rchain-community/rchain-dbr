<?php
class tables_issue {
  function getTitle(&$record){
    $num = $record->val('num');
    $title = $record->val('title');
    return '#' . $num.' '.$title;
  }

  function title__htmlValue(&$record){
    $num = $record->val('num');
    $title = $record->val('title');
    return link_markup('https://github.com/rchain/bounties/issues/'.$num, $title);
  }

  function num__htmlValue(&$record){
    $num = $record->val('num');
    return link_markup('https://github.com/rchain/bounties/issues/'.$num, $num);
  }

}
