import 'should'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const lockfilePath = join(__dirname, '..', 'package-lock.json')
const packageJsonPath = join(__dirname, '..', 'package.json')

describe('package-lock.json', () => {
  let lockfileText, lockfile, packageJson

  before(async () => {
    lockfileText = await readFile(lockfilePath, 'utf-8')
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
  })

  describe('validity', () => {
    it('should be valid JSON', () => {
      (() => { lockfile = JSON.parse(lockfileText) }).should.not.throw()
      lockfile = JSON.parse(lockfileText)
    })

    it('should start with a JSON object opening brace', () => {
      lockfileText.trimStart().should.startWith('{')
    })

    it('should not start with a partial integrity hash fragment', () => {
      const firstChar = lockfileText.trimStart()[0]
      firstChar.should.equal('{')
    })
  })

  describe('required top-level fields', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    it('should have a name field matching package.json', () => {
      lockfile.should.have.property('name', packageJson.name)
    })

    it('should have a version field matching package.json', () => {
      lockfile.should.have.property('version', packageJson.version)
    })

    it('should have a lockfileVersion field', () => {
      lockfile.should.have.property('lockfileVersion')
      lockfile.lockfileVersion.should.be.a.Number()
    })

    it('should have lockfileVersion of 2 or higher', () => {
      lockfile.lockfileVersion.should.be.aboveOrEqual(2)
    })

    it('should have a packages field', () => {
      lockfile.should.have.property('packages')
      lockfile.packages.should.be.an.Object()
    })
  })

  describe('root package entry', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    it('should have a root package entry (empty string key)', () => {
      lockfile.packages.should.have.property('')
    })

    it('should have the correct project name in the root entry', () => {
      lockfile.packages[''].should.have.property('name', packageJson.name)
    })

    it('should have the correct version in the root entry', () => {
      lockfile.packages[''].should.have.property('version', packageJson.version)
    })

    it('should have dependencies in the root entry', () => {
      lockfile.packages[''].should.have.property('dependencies')
      lockfile.packages[''].dependencies.should.be.an.Object()
    })

    it('should have devDependencies in the root entry', () => {
      lockfile.packages[''].should.have.property('devDependencies')
      lockfile.packages[''].devDependencies.should.be.an.Object()
    })
  })

  describe('runtime dependency coverage', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    const runtimeDeps = [
      'chalk',
      'commander',
      'copy-paste',
      'lodash-es',
      'mkdirp',
      'open',
      'read',
      'shell-quote',
      'split',
      'through',
      'wikibase-edit',
      'wikibase-sdk',
      'wikidata-lang',
    ]

    for (const dep of runtimeDeps) {
      it(`should have a locked entry for runtime dependency: ${dep}`, () => {
        const key = `node_modules/${dep}`
        lockfile.packages.should.have.property(key)
      })

      it(`should have a non-empty version for: ${dep}`, () => {
        const key = `node_modules/${dep}`
        const entry = lockfile.packages[key]
        entry.should.have.property('version')
        entry.version.should.be.a.String()
        entry.version.length.should.be.above(0)
      })
    }
  })

  describe('dev dependency coverage', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    const devDeps = [
      'mocha',
      'should',
      'eslint',
    ]

    for (const dep of devDeps) {
      it(`should have a locked entry for dev dependency: ${dep}`, () => {
        const key = `node_modules/${dep}`
        lockfile.packages.should.have.property(key)
      })
    }
  })

  describe('package entry integrity', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    it('should not have any package entry with an integrity value starting mid-hash', () => {
      const packages = Object.entries(lockfile.packages)
      for (const [ name, entry ] of packages) {
        if (entry.integrity) {
          entry.integrity.should.match(
            /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/,
            `Package ${name} has malformed integrity: ${entry.integrity}`,
          )
        }
      }
    })

    it('should have all package entries as objects', () => {
      const packages = Object.values(lockfile.packages)
      for (const entry of packages) {
        entry.should.be.an.Object()
      }
    })

    it('should have all non-root package entries with a version field', () => {
      const nonRootPackages = Object.entries(lockfile.packages).filter(([ key ]) => key !== '')
      for (const [ name, entry ] of nonRootPackages) {
        entry.should.have.property('version', entry.version, `Package ${name} is missing a version`)
        entry.version.should.be.a.String()
      }
    })
  })

  describe('root entry dependency alignment', () => {
    before(() => {
      lockfile = JSON.parse(lockfileText)
    })

    it('should list all package.json dependencies in the root entry', () => {
      const rootDeps = lockfile.packages[''].dependencies
      const pkgDeps = Object.keys(packageJson.dependencies)
      for (const dep of pkgDeps) {
        rootDeps.should.have.property(dep)
      }
    })

    it('should list all package.json devDependencies in the root entry', () => {
      const rootDevDeps = lockfile.packages[''].devDependencies
      const pkgDevDeps = Object.keys(packageJson.devDependencies)
      for (const dep of pkgDevDeps) {
        rootDevDeps.should.have.property(dep)
      }
    })

    it('should not have extra top-level dependencies not in package.json', () => {
      const rootDeps = Object.keys(lockfile.packages[''].dependencies || {})
      const allDeclared = new Set([
        ...Object.keys(packageJson.dependencies),
        ...Object.keys(packageJson.devDependencies),
      ])
      for (const dep of rootDeps) {
        allDeclared.has(dep).should.be.true(`Undeclared dependency in lock root entry: ${dep}`)
      }
    })
  })
})
