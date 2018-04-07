delimiter //
drop trigger if exists percent_max_100_insert //
create trigger percent_max_100_insert
before insert on reward_vote for each row
begin
  declare pct_tot int;
  select coalesce(sum(greatest(percent, 0)), 0) into pct_tot
  from reward_vote cur
  where cur.pay_period = new.pay_period
    and cur.issue_num = new.issue_num
    and cur.voter = new.voter;
  if(pct_tot + new.percent > 100) then
    signal sqlstate '45000' set message_text = 'Your reward votes on this issue would exceed 100%.';
  end if;
end
//

drop trigger if exists percent_max_100_update //
create trigger percent_max_100_update
before update on reward_vote
for each row
begin
  declare pct_tot int;
  select coalesce(sum(greatest(percent, 0)), 0) into pct_tot
  from reward_vote cur
  where cur.pay_period = new.pay_period
      and cur.issue_num = new.issue_num
      and cur.voter = new.voter;
  if(pct_tot - old.percent + new.percent > 100) then
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Your reward votes on this issue would exceed 100%.';
  end if;
end
//

create trigger current_edit_bv_insert
before insert on budget_vote for each row begin
  if (new.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'budget votes must use current pay period';
  end if;
end
//
create trigger current_edit_rv_insert
before insert on reward_vote for each row begin
  if (new.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'reward votes must use current pay period';
  end if;
end
//
create trigger current_edit_bv_delete
before delete on budget_vote for each row begin
  if (old.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'delete budget vote from current pay period only';
  end if;
end
//
create trigger current_edit_rv_delete
before delete on reward_vote for each row begin
  if (old.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'delete reward vote from current pay period only';
  end if;
end
//
create trigger current_edit_bv_update
before update on budget_vote for each row begin
  if (new.pay_period != old.pay_period ||
      new.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'update budget vote from current pay period only';
  end if;
end
//
create trigger current_edit_rv_update
before update on reward_vote for each row begin
  if (new.pay_period != old.pay_period ||
      new.pay_period != (select current_pay_period from admin_settings)) then
    signal sqlstate '45000' set message_text = 'update reward vote from current pay period only';
  end if;
end
//
