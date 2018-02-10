delimiter //
drop trigger if exists percent_max_100_insert //
create trigger percent_max_100_insert
before insert on reward_vote for each row
begin
  declare pct_tot int;
  select coalesce(sum(percent), 0) into pct_tot
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
  select coalesce(sum(percent), 0) into pct_tot
  from reward_vote cur
  where cur.pay_period = new.pay_period
      and cur.issue_num = new.issue_num
      and cur.voter = new.voter;
  if(pct_tot - old.percent + new.percent > 100) then
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Your reward votes on this issue would exceed 100%.';
  end if;
end
//
