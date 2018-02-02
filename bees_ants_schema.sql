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

drop table if exists admin_settings;
create table admin_settings (
        id integer primary key auto_increment,
        current_pay_period date not null,
        foreign key fk_admin_period(current_pay_period)
        references pay_period(start_date)
        )
    ;

-- TODO: one vote per voter per issue?
drop table if exists budget_vote;

create table budget_vote (
  id integer primary key auto_increment,
  issue_num integer not null,
  amount decimal(13, 2) not null,  -- USD * 100
  pay_period date not null,
  voter varchar(64) not null,
  vote_time timestamp,
  foreign key fk_budget_period(pay_period) references pay_period(start_date),
  foreign key fk_budget_issue(issue_num) references issue(num),
  foreign key fk_budget_voter(voter) references github_users(login)
)
;

-- TODO: one vote per voter per issue x worker?
drop table if exists reward_vote;

create table reward_vote (
  id integer primary key auto_increment,
  issue_num integer not null,
  percent integer not null,  -- TODO: constrain betwen 1 and 100
  worker varchar(64) not null,
  pay_period date not null,
  voter varchar(64) not null,
  vote_time timestamp not null,
  foreign key fk_reward_period(pay_period) references pay_period(start_date),
  foreign key fk_reward_issue(issue_num) references issue(num),
  foreign key fk_reward_voter(voter) references github_users(login),
  foreign key fk_reward_worker(worker) references github_users(login),
  check (percent between 0 and 100)
)
;


-- TODO: latest vote only.
create or replace view issue_budget as
select pay_period, issue_num, title, voter_qty, voters, amount_avg
     , case when voter_qty >= 3 then amount_avg else null end amount_effective
from (
	select bv.issue_num, i.title
	     , count(distinct bv.voter) voter_qty
	     , group_concat(bv.voter separator ', ') voters
	     , round(avg(bv.amount), 2) amount_avg
             , bv.pay_period
	from issue i
	    join budget_vote bv on bv.issue_num = i.num
            join admin_settings s on s.current_pay_period = bv.pay_period
	group by i.num, i.title
) ea
;
-- select * from issue_budget;

create or replace view reward as
select pay_period, worker, issue_num, title
     , voter_qty, voters
     , budget_avg, budget_effective
     , percent_avg
     , reward_avg
     , case when voter_qty >= 3 then reward_effective else null end reward_effective
from (
	select ib.pay_period, ib.issue_num, ib.title, rv.worker
	     , count(distinct rv.voter) voter_qty
	     , group_concat(rv.voter separator ', ') voters
             , ib.amount_avg budget_avg
             , ib.amount_effective budget_effective
	     , round(avg(rv.percent), 2) percent_avg
	     , round(avg(rv.percent) / 100 * ib.amount_avg) reward_avg
	     , round(avg(rv.percent) / 100 * ib.amount_effective) reward_effective
	from issue_budget ib
	join reward_vote rv on rv.issue_num = ib.issue_num and rv.pay_period = ib.pay_period
	group by ib.pay_period, ib.issue_num, ib.title, rv.worker
) ea
;
