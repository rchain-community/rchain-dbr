drop table if exists issue;
create table issue (
  num integer primary key,
  title varchar(1024) not null,
  repo varchar(1024) not null
)
;

drop table if exists pay_period;

create table pay_period (
        start_date date primary key,
        end_date date not null
        )
    ;
    -- Rchain RHOC Volume Weighted Average
    --    https://docs.google.com/spreadsheets/d/1XlbJchQhIVmn57pe8eeJ9QctKIWk5KLEToRyCGu2TgM/edit#gid=356502091
    alter table pay_period add (usd_per_rhoc decimal(12, 3));
    -- update pay_period set usd_per_rhoc=1.615;

drop table if exists admin_settings;
create table admin_settings (
        id integer primary key auto_increment,
        current_pay_period date not null,
        foreign key fk_admin_period(current_pay_period)
        references pay_period(start_date)
        )
    ;

drop table if exists budget_vote;

create table budget_vote (
  pay_period date not null,
  issue_num integer not null,
  voter varchar(64) not null,
  amount decimal(13, 2) not null,
  vote_time timestamp not null,
  primary key(pay_period, issue_num, voter),
  foreign key fk_budget_period(pay_period) references pay_period(start_date),
  foreign key fk_budget_issue(issue_num) references issue(num),
  foreign key fk_budget_voter(voter) references github_users(login)
)
;

drop table if exists reward_vote;

create table reward_vote (
  pay_period date not null,
  issue_num integer not null,
  voter varchar(64) not null,
  worker varchar(64) not null,
  percent integer not null,
  vote_time timestamp not null,
  primary key(pay_period, issue_num, voter, worker),
  foreign key fk_reward_period(pay_period) references pay_period(start_date),
  foreign key fk_reward_issue(issue_num) references issue(num),
  foreign key fk_reward_voter(voter) references github_users(login),
  foreign key fk_reward_worker(worker) references github_users(login)
)
;

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

delimiter ;

create or replace view issue_budget as
select issue_num, title
    , case when voter_qty >= 3 then budget_provisional else null end budget_usd
    , budget_provisional, voter_qty, voters, pay_period
from (
	select bv.issue_num, i.title
	     , count(distinct bv.voter) voter_qty
	     , group_concat(bv.voter separator ', ') voters
	     , round(avg(bv.amount), 2) budget_provisional
             , bv.pay_period
	from issue i
	    join budget_vote bv on bv.issue_num = i.num
            join admin_settings s on s.current_pay_period = bv.pay_period
	group by i.num, i.title
) ea
;
-- select * from issue_budget;

create or replace view reward as
select issue_num, title
     , worker
     , case when voter_qty >= 3 then reward_usd_1 else null end reward_usd
     , percent_avg
     , budget_usd
     , voter_qty, voters
     , reward_provisional
     , budget_provisional
     , pay_period
from (
	select ib.pay_period, ib.issue_num, ib.title, rv.worker
	     , count(distinct rv.voter) voter_qty
	     , group_concat(rv.voter separator ', ') voters
             , ib.budget_provisional
             , ib.budget_usd
	     , round(avg(rv.percent), 2) percent_avg
	     , round(avg(rv.percent) / 100 * ib.budget_provisional) reward_provisional
	     , round(avg(rv.percent) / 100 * ib.budget_usd) reward_usd_1
	from issue_budget ib
	join reward_vote rv on rv.issue_num = ib.issue_num and rv.pay_period = ib.pay_period
	group by ib.pay_period, ib.issue_num, ib.title, rv.worker
) ea
;


drop table if exists invoice_info;

create table invoice_info (
  pay_period date not null,
  worker varchar(64) not null,
  name varchar(128) not null,
  rhoc_wallet varchar(128),
  primary key(pay_period, worker),
  foreign key fk_invoice_worker(worker) references github_users(login),
  foreign key fk_invoice_period(pay_period) references pay_period(start_date)
  )
;


create or replace view invoice_formatted as

select * from (
        with detail as (
        select doc.*
            , issue_num, title, reward_usd
        from invoice_info doc
            join reward item on doc.pay_period = item.pay_period and doc.worker = item.worker
        where item.reward_usd is not null
            )
        , summary as (
        select distinct pay_period, worker, name, rhoc_wallet
        from detail
            )
    select pay_period, worker, -10 line, null num
        , concat('Invoice # ', date_format(pay_period, '%Y-%m'), '-', worker) description
        , null amount
    from summary

    union all
    select pay_period, worker, -9 line, null num
        , 'To: Rchain Cooperative / 12345 Lake City Way NE #2032 / Seattle, WA 98125 / USA' description
        , null amount
    from summary

    union all
    select pay_period, worker, -8 line, null num
        , concat('From: ', name)
        , null amount
    from summary

    union all
    select pay_period, worker, -7 line, null num
        , concat('ETH ', coalesce(rhoc_wallet, '????')), null amount
    from summary

    union all
    select pay_period, worker, issue_num, issue_num, title, reward_usd
    from detail

    union all
    select pay_period, worker, 1000000, null, ' ** TOTAL (USD):', sum(reward_usd)
    from detail group by pay_period, worker

    union all
    select pay_period, worker, 1000002, null, ' ** USD / RHOC:'
        , (select usd_per_rhoc from pay_period
           where start_date = summary.pay_period)
    from summary

    union all
    select pay_period, worker, 1000003, null, ' ** TOTAL (RHOC):'
         , sum(reward_usd) / usd_per_rhoc
    from detail
    join pay_period on pay_period.start_date = detail.pay_period
    group by pay_period, worker, usd_per_rhoc
        ) d
order by d.pay_period, d.worker, d.line
    ;
