"""q2_adj -- adjustments to fix Q2 reporting

Usage:
  q2_adj [options]

Options:
  --claims=FILE    Claims tab [default: cache/Declarations - Claims.csv]
  --month=Mon      Pay period to work on [default: May]
  --config=FILE     config file with github_repo.read_token
                    and _databse.db_url
                    [default: conf.ini]

"""

from sys import stderr

from docopt import docopt
import pandas as pd

from social_coding_sync import IO


def main(argv, cwd, create_engine):
    cli = docopt(__doc__, argv=argv[1:])
    print(cli, file=stderr)
    claims = pd.read_csv(str(cwd / cli['--claims']))
    month = cli['--month']
    pp_claims = claims[claims.Month == month]
    pp_claims = pp_claims[['Total in USD', 'Month', 'GithubName']]
    print(pp_claims.head(), file=stderr)
    io = IO(create_engine, build_opener, cwd / cli['--config'])
    pp_claims.to_sql('claims_' + month, io.db())


def build_opener(*args):
    raise IOError('not allowed')


if __name__ == '__main__':
    def _script():
        from sys import argv
        from pathlib import Path
        from sqlalchemy import create_engine

        main(argv[:], cwd=Path('.'),
             create_engine=create_engine)

    _script()
