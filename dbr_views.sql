create or replace view user_flair as
select u.login, u.verified_coop, r.rating
     , elt(field(r.rating, 1, 2, 3), 'apprentice', 'journeyer',  'master') rating_label
     , elt(field(r.rating, 1, 2, 3), 1, 3,  7) weight
     , concat(u.login,
              case when u.verified_coop is null then '?'
	           else concat(':', right(u.verified_coop, 3)) end,
              coalesce(elt(field(r.rating, 1, 2, 3), ' a*1', ' j*3',  ' m*7'), '')) sig
from github_users u
left join authorities r on u.login = r.login
;


create or replace view issue_budget as
select issue_num, title
    , case when voter_qty >= 3 then budget_provisional else null end budget_usd
    , budget_provisional, voter_qty, voters, pay_period
from (
	select bv.issue_num, i.title
	     , count(distinct uf.verified_coop) voter_qty
	     , group_concat(uf.sig separator ', ') voters
	     , round(avg(bv.amount), 2) budget_provisional
             , bv.pay_period
	from issue i
	    join budget_vote bv on bv.issue_num = i.num
	    join user_flair uf on uf.login = bv.voter and uf.verified_coop is not null
            join admin_settings s on s.current_pay_period = bv.pay_period
	group by bv.pay_period, i.num, i.title
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
	     , count(distinct uf.verified_coop) voter_qty
	     , group_concat(uf.sig separator ', ') voters
             , ib.budget_provisional
             , ib.budget_usd
	     , round(avg(rv.percent), 2) percent_avg
	     , round(avg(rv.percent) / 100 * ib.budget_provisional) reward_provisional
	     , round(avg(rv.percent) / 100 * ib.budget_usd) reward_usd_1
	from issue_budget ib
	join reward_vote rv on rv.issue_num = ib.issue_num and rv.pay_period = ib.pay_period
        join user_flair uf on uf.login = rv.voter and uf.verified_coop is not null
	group by ib.pay_period, ib.issue_num, ib.title, rv.worker
) ea
;


create or replace view invoice_detail as
        select doc.*
            , issue_num, title, reward_usd
        from invoice_info doc
            join reward item on doc.pay_period = item.pay_period and doc.worker = item.worker
        where item.reward_usd is not null
;
create or replace view invoice_summary as
        select distinct pay_period, worker, name, rhoc_wallet
        from invoice_detail
        ;

create or replace view invoice_formatted as

select * from (
    select pay_period, worker, -10 line, null num
        , concat('Invoice # ', date_format(pay_period, '%Y-%m'), '-', worker) description
        , null amount
    from invoice_summary

    union all
    select pay_period, worker, -9 line, null num
        , 'To: Rchain Cooperative / 12345 Lake City Way NE #2032 / Seattle, WA 98125 / USA' description
        , null amount
    from invoice_summary

    union all
    select pay_period, worker, -8 line, null num
        , concat('From: ', name)
        , null amount
    from invoice_summary

    union all
    select pay_period, worker, -7 line, null num
        , concat('ETH ', coalesce(rhoc_wallet, '????')), null amount
    from invoice_summary

    union all
    select pay_period, worker, issue_num, issue_num, title, reward_usd
    from invoice_detail

    union all
    select pay_period, worker, 1000000, null, ' ** TOTAL (USD):', sum(reward_usd)
    from invoice_detail group by pay_period, worker

    union all
    select pay_period, worker, 1000002, null, ' ** USD / RHOC:'
        , (select usd_per_rhoc from pay_period
           where start_date = invoice_summary.pay_period)
    from invoice_summary

    union all
    select pay_period, worker, 1000003, null, ' ** TOTAL (RHOC):'
         , sum(reward_usd) / usd_per_rhoc
    from invoice_detail
    join pay_period on pay_period.start_date = invoice_detail.pay_period
    group by pay_period, worker, usd_per_rhoc
        ) d
order by d.pay_period, d.worker, d.line
    ;
