drop table if exists issue;
create table issue (
  num integer primary key,
  title varchar(1024) not null,
  repo varchar(1024) not null
)
;

drop table if exists person;
create table person (
  gh varchar(64) primary key
)
;

-- TODO: one vote per voter per issue?
drop table if exists budget_vote;
create table budget_vote (
  id integer primary key auto_increment,
  issue_num integer not null,
  amount integer not null,  -- USD * 100
  voter_gh varchar(64) not null,  -- github username
  vote_time timestamp,
  foreign key fk_issue(issue_num) references issue(num),
  foreign key fk_voter(voter_gh) references person(gh)
)
;

-- TODO: one vote per voter per issue x worker?
drop table if exists reward_vote;
create table reward_vote (
  id integer primary key auto_increment,
  issue_num integer not null,
  percent integer not null,  -- TODO: constrain betwen 1 and 100
  worker_gh varchar(64) not null,
  voter_gh varchar(64) not null,
  vote_time timestamp,
  foreign key fk_issue(issue_num) references issue(num),
  foreign key fk_voter(voter_gh) references person(gh),
  foreign key fk_worker(worker_gh) references person(gh)
)
;


-- TODO: latest vote only.
create or replace view issue_budget as
select issue_num, title, voter_qty, voters, amount_avg
     , case when voter_qty >= 3 then amount_avg else null end amount_effective
from (
	select bv.issue_num, i.title
	     , count(distinct bv.voter_gh) voter_qty
	     , group_concat(bv.voter_gh separator ', ') voters
	     , avg(bv.amount) amount_avg
	from issue i
	join budget_vote bv on bv.issue_num = i.num
	group by i.num, i.title
) ea
;
-- select * from issue_budget;

create or replace view reward as
select worker_gh, issue_num, title
     , voter_qty, voters
     , percent_avg
     , amount_avg
     , case when voter_qty >= 3 then amount_effective else null end amount_effective
from (
	select ib.issue_num, ib.title, rv.worker_gh
	     , count(distinct rv.voter_gh) voter_qty
	     , group_concat(rv.voter_gh separator ', ') voters
	     , avg(rv.percent) percent_avg
	     , avg(rv.percent) / 100 * ib.amount_avg amount_avg
	     , avg(rv.percent) / 100 * ib.amount_effective amount_effective
	from issue_budget ib
	join reward_vote rv on rv.issue_num = ib.issue_num
	group by ib.issue_num, ib.title, rv.worker_gh
) ea
;
