import { newId } from './ids'
import { Project, SCHEMA_VERSION, type Skill } from './project'

type Ability = Skill['ability']

/** Prove di caratteristica pura (es. "FOR 15") e abilità della 5ª edizione. */
const DEFAULT_SKILLS: [string, Ability][] = [
  ['Forza', 'str'],
  ['Destrezza', 'dex'],
  ['Costituzione', 'con'],
  ['Intelligenza', 'int'],
  ['Saggezza', 'wis'],
  ['Carisma', 'cha'],
  ['Acrobazia', 'dex'],
  ['Addestrare animali', 'wis'],
  ['Arcano', 'int'],
  ['Atletica', 'str'],
  ['Furtività', 'dex'],
  ['Indagare', 'int'],
  ['Inganno', 'cha'],
  ['Intimidire', 'cha'],
  ['Intrattenere', 'cha'],
  ['Intuizione', 'wis'],
  ['Medicina', 'wis'],
  ['Natura', 'int'],
  ['Percezione', 'wis'],
  ['Persuasione', 'cha'],
  ['Rapidità di mano', 'dex'],
  ['Religione', 'int'],
  ['Sopravvivenza', 'wis'],
  ['Storia', 'int']
]

const DEFAULT_ITEM_TYPES = ['Arma', 'Armatura', 'Chiave', 'Consumabile', 'Oggetto di quest', 'Valuta']

/** Gli elenchi predefiniti hanno id leggibili e uguali in ogni progetto (es. `skl_percezione`). */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
}

export const defaultSkills = (): Skill[] =>
  DEFAULT_SKILLS.map(([name, ability]) => ({ id: `skl_${slug(name)}`, name, ability }))

export const defaultItemTypes = () => DEFAULT_ITEM_TYPES.map((name) => ({ id: `ityp_${slug(name)}`, name }))

export function createEmptyProject(name: string): Project {
  return Project.parse({
    schemaVersion: SCHEMA_VERSION,
    id: newId('project'),
    name,
    settings: { skills: defaultSkills(), itemTypes: defaultItemTypes() }
  })
}
