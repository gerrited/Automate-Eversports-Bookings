import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Diese Grautöne erreichen auf den dunklen Petrol-Flächen keine 4,5:1 (WCAG 1.4.3).
// Stattdessen text-faint (≥ 4,5:1 auf allen Flächen) oder text-muted verwenden.
const FORBIDDEN = [/\btext-slate-(500|600|700)\b/, /placeholder-slate-\d+/, /#6b7f8c/i]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('Farbkontrast', () => {
  it('verwendet keine Textfarben mit zu geringem Kontrast', () => {
    const offenders = sourceFiles(resolve(__dirname)).flatMap(file =>
      readFileSync(file, 'utf8').split('\n').flatMap((line, i) =>
        FORBIDDEN.some(re => re.test(line)) ? [`${file}:${i + 1}`] : [],
      ),
    )
    expect(offenders).toEqual([])
  })
})
