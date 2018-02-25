drop table if exists issue;
create table issue (
  num integer primary key,
  title varchar(1024) not null,
  status varchar(32) not null,
  repo varchar(1024) not null
)
;

drop table if exists pay_period;

create table pay_period (
        start_date date primary key,
        end_date date not null,
    -- Rchain RHOC Volume Weighted Average
    --    https://docs.google.com/spreadsheets/d/1XlbJchQhIVmn57pe8eeJ9QctKIWk5KLEToRyCGu2TgM/edit#gid=356502091
    -- update pay_period set usd_per_rhoc=1.615;
        usd_per_rhoc decimal(12, 3)
        )
    ;

drop table if exists admin_settings;
create table admin_settings (
        id integer primary key, --  auto_increment
        current_pay_period date not null,
        foreign key (current_pay_period) -- fk_admin_period
        references pay_period(start_date)
        )
    ;

drop table if exists budget_vote;

create table budget_vote (
  pay_period date not null,
  issue_num integer not null,
  voter varchar(64) not null,
  amount decimal(13, 2) not null,
  vote_time timestamp not null default current_timestamp,
  primary key(pay_period, issue_num, voter),
  foreign key (pay_period) references pay_period(start_date), -- fk_budget_period
  foreign key (issue_num) references issue(num), -- fk_budget_issue
  foreign key (voter) references github_users(login) -- fk_budget_voter
)
;

drop table if exists reward_vote;

create table reward_vote (
  pay_period date not null,
  issue_num integer not null,
  voter varchar(64) not null,
  worker varchar(64) not null,
  percent integer not null,
  vote_time timestamp not null default current_timestamp,
  primary key(pay_period, issue_num, voter, worker),
  foreign key (pay_period) references pay_period(start_date), -- fk_reward_period
  foreign key (issue_num) references issue(num), -- fk_reward_issue
  foreign key (voter) references github_users(login), -- fk_reward_voter
  foreign key (worker) references github_users(login) -- fk_reward_worker
)
;


drop table if exists invoice_info;

create table invoice_info (
  pay_period date not null,
  worker varchar(64) not null,
  name varchar(128) not null,
  rhoc_wallet varchar(128),
  primary key(pay_period, worker),
  foreign key (worker) references github_users(login), -- fk_invoice_worker
  foreign key (pay_period) references pay_period(start_date) -- fk_invoice_period
  )
;


drop table if exists trust_cert;

create table trust_cert (
        subject varchar(64) not null,
        voter varchar(64) not null,
        rating int not null,  -- TODO: check constraint: 1, 2, 3
        cert_time timestamp not null default current_timestamp,
        primary key(voter, subject),
        foreign key (voter) references github_users(login), -- fk_cert_voter
        foreign key (subject) references github_users(login) -- fk_cert_worker
        )
    ;
