"""social_coding_sync -- sync users, issues, endorsements from github

Usage:
  social_coding_sync [options] issues_fetch
  social_coding_sync [options] issues_insert
  social_coding_sync [options] users_fetch
  social_coding_sync [options] users_insert
  social_coding_sync [options] reactions_get
  social_coding_sync [options] trust_seed
  social_coding_sync [options] trusted

Options:
  --config=FILE     config file with github_repo.read_token
                    and _databse.db_url
                    [default: conf.ini]
  --seed=NAMES      login names (comma separated) of trust seed
                    [default: dckc,Jake-Gillberg]
  --capacities=XS   network flow capacities (comma separated)
                    [default: 21,13,8,5]
  --cache=DIR       directory for query results [default: cache]
  --voter=NAME      test voter for logging [default: dckc]

.. note: This line separates usage notes above from design notes below.

"""

from configparser import SafeConfigParser
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

    def config():
        log.info('config: %s', opt['--config'])
        with (cwd / opt['--config']).open('r') as txt_in:
            cp = headless_config(txt_in, opt['--config'])
        return cp

    def db():
        cp = config()
        url = cp.get('_database', 'db_url')
        return create_engine(url)

    def tok():
        return config().get('github_repo', 'read_token')

    def cache_open(filename, mode, what, encoding=None):
        path = cwd / opt['--cache'] / filename
        log.info('%s %s to %s',
                 'Writing' if mode == 'w' else 'Reading',
                 what, path)
        return path.open(mode=mode, encoding=encoding)


    if opt['issues_fetch']:
        issues = Issues(build_opener(), tok())
        issueInfo = issues.fetch_pages()
        with cache_open('issues.json', mode='w',
                        what='%d pages of issues' % len(issueInfo)) as fp:
            json.dump(issueInfo, fp)

    elif opt['issues_insert']:
        with cache_open('issues.json', mode='r', encoding='utf-8',
                        what='issueInfo') as fp:
            issuePages = json.load(fp)
        Issues.db_sync(db(), Issues.data(issuePages), 'issue')

    elif opt['users_fetch']:
        user_q = Collaborators(build_opener(), tok())
        userInfo = user_q.fetch_pages()
        with cache_open('users.json', mode='w',
                        what='%d pages of users' % len(userInfo)) as fp:
            json.dump(userInfo, fp)

    elif opt['users_insert']:
        with cache_open('users.json', mode='r', encoding='utf-8',
                        what='userInfo') as fp:
            userPages = json.load(fp)
        Collaborators.db_sync(db(), Collaborators.data(userPages), 'github_users')

    elif opt['reactions_get']:
        rs = Reactions(build_opener(), tok())
        info = rs.fetch(dest=cwd / opt['--cache'] / 'reactions.json')
        log.info('%d reactions saved to %s',
                 len(info['repository']['issues']['nodes']), opt['--cache'])

    elif opt['trust_seed']:
        log.info('using cache %s to get saved reactions', opt['--cache'])
        with cache_open('reactions.json', mode='r', what='reactions') as fp:
            reaction_info = json.load(fp)
        dbr = db()
        reactions = Reactions.normalize(reaction_info)
        TrustCert.seed_from_reactions(reactions, dbr).reset_index()

    elif opt['trusted']:
        dbr = db()
        seed = opt['--seed'].split(',')
        capacities = [int(c) for c in opt['--capacities'].split(',')]
        trusted = pd.concat([
            TrustCert.trust_flow(dbr, seed, capacities, rating).reset_index()
            for rating in TrustCert.ratings])
        trusted = trusted.groupby('login').max()
        trusted = trusted.sort_index()
        trusted.to_sql('authorities', if_exists='replace', con=dbr,
                       dtype=noblob(trusted))
        log.info('trusted.head():\n%s', trusted.head())


def headless_config(fp, fname):
    txt = '[root]\r\n' + fp.read()
    cp = SafeConfigParser()
    cp.read_string(txt, fname)
    return cp


class QuerySvc(object):
    endpoint = 'https://api.github.com/graphql'
    query = "query { viewer { login } }"

    def __init__(self, urlopener, token):
        self.__urlopener = urlopener
        self.__token = token

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

    def _page_q(self, cursor):
        maybeParens = lambda s: '(' + s + ')' if s else ''
        fmtParams = lambda params: ', '.join(
            part
            for k, (val, ty) in params.items()
            for part in ([('$' + k + ':' + ty)] if val else []))
        paramInfo = dict(cursor=[cursor, 'String!'])
        variables = {k: v for (k, [v, _t]) in paramInfo.items()}
        return variables, (
            self.query
            .replace('PARAMETERS', maybeParens(fmtParams(paramInfo)))
            .replace('CURSOR', ' after: $cursor' if cursor else ''))

    def fetch_pages(self):
        pageInfo = {'endCursor': None}
        pages = []
        while 1:
            variables, query = self._page_q(pageInfo['endCursor'])
            info = self.runQ(query, variables)
            pageInfo = info.get('repository', {}).get(self.connection, {}).get('pageInfo', {})
            log.info('pageInfo: %s', pageInfo)
            pages.append(info)
            if not pageInfo.get('hasNextPage', False):
                return pages

    def fetch(self, dest=None):
        info = self.runQ(self.query)
        if dest:
            with dest.open('w') as data_fp:
                json.dump(info, data_fp)
        return info

    @classmethod
    def db_sync(cls, db, data, table):
        log.info('db_sync cols: %s', data.dtypes)
        cols = ', '.join(data.columns.values)
        params = ', '.join(
            ('%%(%s)s' % name) for name in data.columns)
        assignments = ', '.join(
            ('%s = values(%s)' % (name, name) for name in data.columns))
        sql = '''
        insert into %(table)s (%(cols)s)
        values (%(params)s)
        on duplicate key update
        %(assignments)s
        ''' % dict(cols=cols, params=params, assignments=assignments, table=table)
        log.info('db_sync SQL: %s', sql)
        records = data.to_dict(orient='records')
        with db.begin() as trx:
            trx.execute(sql, records)


class Reactions(QuerySvc):
    query = pkg.resource_string(__name__, 'reactions.graphql').decode('utf-8')

    endorsements = ['HEART', 'HOORAY', 'LAUGH', 'THUMBS_UP']

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


class Issues(QuerySvc):
    query = pkg.resource_string(__name__, 'issues.graphql').decode('utf-8')
    connection = 'issues'

    @classmethod
    def data(self, pages,
             repo='rchain/bounties'):
        df = pd.DataFrame([
            dict(num=node['number'],
                 title=node['title'],
                 updatedAt=node['updatedAt'],
                 state=node['state'],
                 repo=repo)
            for page in pages
            for node in page['repository']['issues']['nodes']
        ])
        # df['updatedAt'] = pd.to_datetime(df.updatedAt)
        df['updatedAt'] = df.updatedAt.str.replace('T', ' ').str.replace('Z', '')
        return df


class Collaborators(QuerySvc):
    query = pkg.resource_string(__name__, 'collaborators.graphql').decode('utf-8')
    connection = 'collaborators'

    @classmethod
    def data(self, pages):
        df = pd.DataFrame(
            [dict(edge['node'],
                  permission=edge['permission'],
                  followers=edge['node']['followers']['totalCount'])
             for page in pages
             for edge in page['repository']['collaborators']['edges']],
            columns=['login', 'followers', 'name', 'location', 'email',
                     'bio', 'websiteUrl', 'avatarUrl', 'permission', 'createdAt'])
        # df = df.set_index('login')
        # df.createdAt = pd.to_datetime(df.createdAt)
        df = df.fillna(value='')
        df.createdAt = df.createdAt.str.replace('T', ' ').str.replace('Z', '')
        return df


class TrustCert(object):
    table = 'trust_cert'

    ratings = [1, 2, 3]

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
    def trust_flow(cls, dbr, seed, capacities, rating=1):
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

        superseed = "<superseed>"
        for s in seed:
            g.add_edge(superseed, s)

        flow = g.max_flow_extract(superseed, capacities)
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
