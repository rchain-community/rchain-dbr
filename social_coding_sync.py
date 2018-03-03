"""social_coding_sync -- sync users, issues, endorsements from github

Usage:
  social_coding_sync [options] reactions_get
  social_coding_sync [options] trust_seed
  social_coding_sync [options] trusted

Options:
  --repo-rd=FILE    JSON file with repository read-access token
                    [default: creds/ram-dbr-access-token.json]
  --db-access=FILE  JSON file with DB access credentials
                    [default: creds/ram-dbr-db-access.json]
  --cache=DIR       directory for query results [default: cache]
  --voter=NAME      test voter for logging [default: dckc]

.. note: This line separates usage notes above from design notes below.

"""

from urllib.request import Request
import json
import logging

from docopt import docopt
import pandas as pd
import pkg_resources as pkg
import sqlalchemy as sqla

import net_flow

log = logging.getLogger(__name__)


def main(argv, cwd, build_opener, create_engine):
    log.debug('argv: %s', argv)
    opt = docopt(__doc__.split('\n..', 1)[0], argv=argv[1:])
    log.debug('opt: %s', opt)

    cache = cwd / opt['--cache']

    def db():
        with (cwd / opt['--db-access']).open('r') as txt_in:
            url = json.load(txt_in)["url"]
        return create_engine(url)

    if opt['reactions_get']:
        Reactions.get(build_opener(),
                      cred_path=cwd / opt['--repo-rd'],
                      dest=cache / 'reactions.json')
    elif opt['trust_seed']:
        with (cache / 'reactions.json').open('r') as fp:
            reaction_info = json.load(fp)
        dbr = db()
        reactions = Reactions.normalize(reaction_info)
        TrustCert.seed_from_reactions(reactions, dbr).reset_index()
    elif opt['trusted']:
        dbr = db()
        trusted = pd.concat([
            TrustCert.trust_flow(dbr, rating).reset_index()
            for rating in TrustCert.ratings])
        trusted = trusted.groupby('login').max()
        trusted = trusted.sort_index()
        trusted.to_sql('authorities', if_exists='replace', con=dbr,
                       dtype=noblob(trusted))
        log.info('trusted.head():\n%s', trusted.head())


class QuerySvc(object):
    endpoint = 'https://api.github.com/graphql'

    def __init__(self, urlopener, token):
        self.__urlopener = urlopener
        self.__token = token

    @classmethod
    def make(cls, cred_path, web_ua):
        with cred_path.open() as cred_fp:
            repoRd = json.load(cred_fp)['token']
        return cls(web_ua, repoRd)

    def runQ(self, query, variables={}):
        req = Request(
            self.endpoint,
            data=json.dumps({'query': query,
                             'variables': variables}).encode('utf-8'),
            headers={
                "Authorization": "bearer " + self.__token
            })
        log.info("query -> %s", self.endpoint)
        response = self.__urlopener.open(req)
        if response.getcode() != 200:
            raise response
        body = json.loads(response.read().decode('utf-8'))
        if body.get('errors'):
            raise IOError(body['errors'])
        return body['data']


class Reactions(object):
    query = pkg.resource_string(__name__, 'reactions.graphql').decode('utf-8')

    endorsements = ['HEART', 'HOORAY', 'LAUGH', 'THUMBS_UP']

    @classmethod
    def get(cls, web_ua, cred_path, dest):
        with cred_path.open() as cred_fp:
            repoRd = json.load(cred_fp)['token']
        qs = QuerySvc(web_ua, repoRd)
        # login = qs.runQ('query { viewer { login }}')
        # log.info(login)

        reaction_info = qs.runQ(Reactions.query)
        with dest.open('w') as data_fp:
            json.dump(reaction_info, data_fp)
        log.info('%d reactions saved to %s',
                 len(reaction_info['repository']['issues']['nodes']), dest)

    @classmethod
    def normalize(cls, info):
        log.info('dict to df...')
        reactions = pd.DataFrame([
            dict(user=reaction['user']['login'],
                 # issue_num=issue['number'],
                 # content=reaction['content'],
                 author=comment['author']['login'],
                 createdAt=comment['createdAt'])
            for issue in info['repository']['issues']['nodes']
            for comment in issue['comments']['nodes']
            for reaction in comment['reactions']['nodes']
            if reaction['content'] in cls.endorsements
        ])
        reactions.createdAt = pd.to_datetime(reactions.createdAt)
        return reactions


class TrustCert(object):
    table = 'trust_cert'

    ratings = [1, 2, 3]

    # capacities = [800, 200, 50, 12, 4, 2, 1] # fom net_flow.py
    capacities = [100, 50, 12, 4, 2, 1]  # fom net_flow.py
    seed = ['lapin7', 'kitblake', u'jimscarver']

    @classmethod
    def seed_from_reactions(cls, reactions, dbr):
        certs = reactions.reset_index().rename(columns={
            'user': 'voter',
            'author': 'subject',
            'createdAt': 'cert_time'})
        certs = certs.groupby(['voter', 'subject'])[['cert_time']].max()
        certs['rating'] = 1
        certs = certs.reset_index()
        log.info('dckc certs:\n%s',
                 certs[certs.voter == 'dckc'])
        log.info('to_sql...')
        users = pd.read_sql('select * from github_users', con=dbr)
        ok = certs.voter.isin(users.login) & certs.subject.isin(users.login)
        if not all(ok):
            log.warn('bad users:\n%s', certs[~ok])
            certs = certs[ok]
        dbr.execute('delete from %s' % cls.table)
        certs = certs.set_index(['voter', 'subject'])
        certs.to_sql(cls.table, con=dbr, if_exists='append',
                     dtype=noblob(certs))
        log.info('%d rows inserted into %s:\n%s',
                 len(certs), cls.table, certs.head())
        return certs

    @classmethod
    def trust_flow(cls, dbr, rating=1):
        g = net_flow.NetFlow()

        last_cert = pd.read_sql('''
            select subject, max(cert_time) last_cert_time
            from {table}
            where rating >= {rating}
            group by subject
        '''.format(table=cls.table, rating=rating), dbr).set_index('subject')

        edges = pd.read_sql('''
            select distinct voter, subject
            from {table}
            where rating >= {rating}
        '''.format(table=cls.table, rating=rating), dbr)
        for _, e in edges.iterrows():
            g.add_edge(e.voter, e.subject)

        superseed = "superseed"
        for s in cls.seed:
            g.add_edge(superseed, s)

        flow = g.max_flow_extract(superseed, cls.capacities)
        ok = pd.DataFrame([
            dict(login=login)
            for login, value in flow.items()
            if login != 'superseed' and value > 0
        ]
        ).set_index('login')
        ok['rating'] = rating
        return ok.merge(last_cert,
                        left_index=True, right_index=True, how='left')


def noblob(df,
           pad=4):
    """no blobs; use string types instead

    Pandas defaults string fields to clobs to be safe,
    but the resulting performance is abysmal.
    """
    df = df.reset_index()
    return {col: sqla.types.String(length=pad + df[col].str.len().max())
            for col, t in zip(df.columns.values, df.dtypes)
            if t.kind == 'O'}


if __name__ == '__main__':
    def _script():
        from sys import argv
        from urllib.request import build_opener
        from pathlib import Path
        from sqlalchemy import create_engine

        logging.basicConfig(level=logging.INFO)
        main(argv, cwd=Path('.'),
             build_opener=build_opener,
             create_engine=create_engine)

    _script()
