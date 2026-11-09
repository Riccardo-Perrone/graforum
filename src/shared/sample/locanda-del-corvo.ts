import { Project, SCHEMA_VERSION, defaultItemTypes, defaultSkills, type ProjectInput } from '../model'

// Progetto di esempio "La locanda del Corvo" (dati del brief di design).
// Gli id sono leggibili e fissi: i test vi fanno riferimento.

const lineAt = (x: number, y: number) => ({ x, y })

const input: ProjectInput = {
  schemaVersion: SCHEMA_VERSION,
  id: 'prj_corvo',
  name: 'La locanda del Corvo',
  description: 'Avventura di esempio: Brumavalle, la sua locanda e il segreto della cantina.',
  startSceneId: 'scn_piazza',
  settings: {
    skills: defaultSkills(),
    itemTypes: defaultItemTypes(),
    currencyItemId: 'itm_moneta'
  },
  groups: [
    { id: 'grp_brumavalle', name: 'Villaggio di Brumavalle', entrySceneIds: ['scn_piazza'], exitSceneIds: ['scn_piazza'] },
    {
      id: 'grp_locanda',
      name: 'Locanda del Corvo',
      parentId: 'grp_brumavalle',
      entrySceneIds: ['scn_sala'],
      exitSceneIds: ['scn_sala', 'scn_tesoro']
    }
  ],
  scenes: [
    {
      id: 'scn_piazza',
      title: 'Piazza del villaggio',
      description: 'Il cuore di Brumavalle: una fontana muschiosa, botteghe chiuse e l’insegna del Corvo che cigola.',
      groupId: 'grp_brumavalle',
      npcs: [{ npcId: 'npc_capitano', dialogs: [{ dialogId: 'dlg_rapporto' }] }],
      position: { x: 0, y: 0 }
    },
    {
      id: 'scn_emporio',
      title: 'Emporio di Mara',
      description: 'Scaffali stipati fino al soffitto. Mara conta le monete senza alzare lo sguardo.',
      groupId: 'grp_brumavalle',
      npcs: [{ npcId: 'npc_mara' }],
      position: { x: 0, y: 260 }
    },
    {
      id: 'scn_pozzo',
      title: 'Pozzo abbandonato',
      description: 'Un pozzo asciutto, coperto da assi marce.',
      groupId: 'grp_brumavalle',
      position: { x: 40, y: 500 }
    },
    {
      id: 'scn_sala',
      title: 'Sala comune',
      description: 'Tavoli lunghi, odore di stufato e un camino che scalda solo metà della stanza.',
      tag: 'safe',
      groupId: 'grp_locanda',
      npcs: [{ npcId: 'npc_bruno', dialogs: [{ dialogId: 'dlg_benvenuto' }] }],
      position: { x: 300, y: 0 }
    },
    {
      id: 'scn_camera3',
      title: 'Camera 3',
      description: 'Una stanza piccola con un letto che scricchiola.',
      tag: 'safe',
      groupId: 'grp_locanda',
      position: { x: 560, y: 0 }
    },
    {
      id: 'scn_cantina',
      title: 'Cantina infestata',
      description:
        'Una scala di pietra scende nel buio. L’aria sa di muffa e di vino andato a male; tra le botti si sente un raschiare continuo.',
      tag: 'warning',
      groupId: 'grp_locanda',
      npcs: [{ npcId: 'npc_bruno', dialogs: [{ dialogId: 'dlg_avvertimento' }] }],
      items: [
        {
          id: 'sit_pozione',
          itemId: 'itm_pozione',
          gate: { condition: { type: 'encounterOutcome', encounterId: 'enc_ratti', outcome: 'win' } }
        },
        {
          id: 'sit_diario',
          itemId: 'itm_diario',
          gate: { condition: { type: 'questState', questId: 'qst_cantina', stepId: 'stp_ratti', state: 'completed' } }
        }
      ],
      encounterIds: ['enc_ratti'],
      entryEffects: [
        { type: 'questAdvance', questId: 'qst_cantina', stepId: 'stp_ratti' },
        { type: 'setFlag', flagId: 'flg_cantina_visitata', value: true }
      ],
      position: { x: 300, y: 260 }
    },
    {
      id: 'scn_tesoro',
      title: 'Stanza del tesoro',
      description: 'Dietro i mattoni, una stanzetta polverosa con una cassa chiusa da un lucchetto arrugginito.',
      groupId: 'grp_locanda',
      items: [
        {
          id: 'sit_cassa',
          itemId: 'itm_spada',
          checks: [
            { id: 'chk_cassa_for', skillId: 'skl_forza', dc: 15, success: {}, failure: {} },
            { id: 'chk_cassa_des', skillId: 'skl_destrezza', dc: 14, success: {}, failure: {} }
          ],
          gate: { condition: { type: 'checkPassed', checkIds: ['chk_cassa_for', 'chk_cassa_des'] } }
        }
      ],
      position: { x: 560, y: 260 }
    },
    {
      id: 'scn_strada',
      title: 'Strada del bosco',
      description: 'Il sentiero si perde tra gli abeti. Tracce di stivali e di carri.',
      position: { x: 880, y: 0 }
    },
    {
      id: 'scn_covo',
      title: 'Covo dei banditi',
      description: 'Un accampamento nascosto in una gola. I fuochi sono ancora caldi.',
      tag: 'warning',
      position: { x: 1140, y: 0 }
    },
    {
      id: 'scn_alba',
      title: 'L’alba su Brumavalle',
      description: 'I banditi sono in catene e il villaggio torna a respirare.',
      position: { x: 1140, y: 260 }
    },
    {
      id: 'scn_patto',
      title: 'Il patto dei banditi',
      description: 'Una stretta di mano con il capo: Brumavalle pagherà, e tu con lei.',
      position: { x: 880, y: 500 }
    }
  ],
  links: [
    { id: 'lnk_piazza_sala', fromSceneId: 'scn_piazza', toSceneId: 'scn_sala', label: 'Entra', bidirectional: true },
    { id: 'lnk_piazza_emporio', fromSceneId: 'scn_piazza', toSceneId: 'scn_emporio', label: 'Bottega', bidirectional: true },
    { id: 'lnk_emporio_pozzo', fromSceneId: 'scn_emporio', toSceneId: 'scn_pozzo', label: 'Vicolo' },
    { id: 'lnk_sala_camera', fromSceneId: 'scn_sala', toSceneId: 'scn_camera3', label: 'Corridoio', bidirectional: true },
    {
      id: 'lnk_sala_cantina',
      fromSceneId: 'scn_sala',
      toSceneId: 'scn_cantina',
      label: 'Scendi in cantina',
      gate: {
        condition: { type: 'hasItem', itemId: 'itm_chiave' },
        whenUnmet: 'locked',
        lockedMessage: 'La porta della cantina è chiusa a chiave.'
      }
    },
    { id: 'lnk_cantina_sala', fromSceneId: 'scn_cantina', toSceneId: 'scn_sala', label: 'Risali le scale' },
    {
      id: 'lnk_cantina_tesoro',
      fromSceneId: 'scn_cantina',
      toSceneId: 'scn_tesoro',
      label: 'Porta nascosta',
      checks: [{ id: 'chk_porta', skillId: 'skl_percezione', dc: 13, success: {}, failure: {} }]
    },
    { id: 'lnk_tesoro_strada', fromSceneId: 'scn_tesoro', toSceneId: 'scn_strada', label: 'Cunicolo' },
    { id: 'lnk_piazza_strada', fromSceneId: 'scn_piazza', toSceneId: 'scn_strada', label: 'Lascia il villaggio' },
    { id: 'lnk_strada_covo', fromSceneId: 'scn_strada', toSceneId: 'scn_covo', label: 'Sentiero' },
    { id: 'lnk_covo_alba', fromSceneId: 'scn_covo', toSceneId: 'scn_alba', label: 'Consegna i banditi' },
    { id: 'lnk_strada_patto', fromSceneId: 'scn_strada', toSceneId: 'scn_patto', label: 'Patto col capo' }
  ],
  endings: [
    { id: 'end_buono', sceneId: 'scn_alba', label: 'Finale buono', color: '#6fcf5b' },
    { id: 'end_oscuro', sceneId: 'scn_patto', label: 'Finale oscuro', color: '#ad86f5' }
  ],
  encounters: [
    {
      id: 'enc_ratti',
      name: 'Ratti della cantina',
      enemies: [{ enemyId: 'eny_ratto', quantity: 3 }],
      nature: 'repeatable',
      rewards: { xp: 75 },
      outcomes: {
        win: { effects: [{ type: 'questAdvance', questId: 'qst_cantina', stepId: 'stp_ratti' }] },
        flee: { target: { type: 'scene', id: 'scn_sala' } },
        defeat: { target: { type: 'scene', id: 'scn_sala' } }
      }
    }
  ],
  npcs: [
    {
      id: 'npc_bruno',
      name: 'Oste Bruno',
      description: 'Robusto, grembiule macchiato di vino, ride forte e spesso.',
      race: 'Umano',
      alignment: 'Neutrale buono',
      role: 'Oste',
      faction: 'Locanda del Corvo',
      secrets: 'Nasconde una copia della chiave sotto il bancone.',
      hp: 18,
      ac: 11,
      speed: '9 m',
      abilities: { str: 12, dex: 10, con: 14, int: 11, wis: 13, cha: 15 },
      services: { inn: 'Camera 5 mo a notte, pasto incluso.' }
    },
    {
      id: 'npc_mara',
      name: 'Mara la mercante',
      role: 'Mercante',
      services: {
        shop: [
          { itemId: 'itm_pozione', price: 50, stock: 3 },
          { itemId: 'itm_spada', price: 10 }
        ]
      }
    },
    { id: 'npc_capitano', name: 'Capitano della guardia', role: 'Guardia' }
  ],
  enemies: [
    {
      id: 'eny_ratto',
      name: 'Ratto gigante',
      creatureType: 'Bestia',
      size: 'Piccola',
      level: 'GS 1/8',
      hp: 7,
      ac: 12,
      speed: '9 m',
      abilities: { str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4 },
      attacks: [{ name: 'Morso', bonus: 4, damage: '1d4+2', damageType: 'perforante', reach: '1,5 m' }],
      traits: [{ name: 'Olfatto acuto', text: 'Vantaggio alle prove di Saggezza (Percezione) basate sull’olfatto.' }],
      loot: { xp: 25 }
    },
    { id: 'eny_bandito', name: 'Bandito', creatureType: 'Umanoide', level: 'GS 1/8', hp: 11, ac: 12 },
    { id: 'eny_capo', name: 'Capo bandito', creatureType: 'Umanoide', level: 'GS 2', hp: 65, ac: 15 }
  ],
  items: [
    { id: 'itm_chiave', name: 'Chiave della cantina', typeId: 'ityp_chiave', weight: 0.1, description: 'Chiave di ferro annerita con un corvo inciso.' },
    { id: 'itm_pozione', name: 'Pozione di cura', typeId: 'ityp_consumabile', consumable: true, stackable: true, weight: 0.5, value: 50 },
    { id: 'itm_spada', name: 'Spada corta', typeId: 'ityp_arma', weight: 1, value: 10 },
    { id: 'itm_diario', name: 'Diario del vinaio', typeId: 'ityp_oggetto_di_quest', weight: 0.5 },
    { id: 'itm_moneta', name: 'Moneta d’oro', typeId: 'ityp_valuta', stackable: true, value: 1 }
  ],
  quests: [
    {
      id: 'qst_cantina',
      title: 'Il segreto della cantina',
      description: 'Dalla cantina della locanda arrivano rumori ogni notte.',
      rewards: { xp: 100, items: [{ itemId: 'itm_pozione', quantity: 1 }] },
      steps: [
        {
          id: 'stp_bruno',
          title: 'Parla con l’oste Bruno',
          requirements: { type: 'dialogChoice', dialogId: 'dlg_benvenuto', choiceId: 'dch_cantina' }
        },
        {
          id: 'stp_ratti',
          title: 'Libera la cantina dai ratti',
          requirements: { type: 'encounterOutcome', encounterId: 'enc_ratti', outcome: 'win' }
        },
        {
          id: 'stp_diario',
          title: 'Trova il diario del vinaio',
          requirements: { type: 'hasItem', itemId: 'itm_diario' }
        }
      ]
    }
  ],
  dialogs: [
    {
      id: 'dlg_benvenuto',
      npcId: 'npc_bruno',
      title: 'Benvenuto alla locanda',
      startLineId: 'dln_b1',
      lines: [
        {
          id: 'dln_b1',
          text: 'Benvenuto al Corvo, viaggiatore! Cerchi un letto o solo qualcosa per scaldarti le ossa?',
          position: lineAt(0, 200),
          choices: [
            { id: 'dch_stanza', text: 'Una stanza per la notte.', targetLineId: 'dln_b2', effects: [{ type: 'loseItem', itemId: 'itm_moneta', quantity: 5 }] },
            {
              id: 'dch_cantina',
              text: 'Cosa succede in cantina? Ho sentito dei rumori.',
              effects: [{ type: 'setFlag', flagId: 'flg_chiesto_cantina', value: true }],
              check: {
                id: 'chk_persuasione',
                skillId: 'skl_persuasione',
                dc: 12,
                success: {
                  target: { type: 'dialogLine', id: 'dln_b3' },
                  effects: [{ type: 'gainItem', itemId: 'itm_chiave' }, { type: 'questStart', questId: 'qst_cantina' }]
                },
                failure: { target: { type: 'dialogLine', id: 'dln_b4' } }
              }
            },
            {
              id: 'dch_chiave',
              text: 'Ho trovato questa chiave dietro il bancone.',
              targetLineId: 'dln_b5',
              gate: { condition: { type: 'hasItem', itemId: 'itm_chiave' } }
            }
          ]
        },
        { id: 'dln_b2', text: 'La numero 3 è libera. Cinque monete d’argento, colazione compresa.', position: lineAt(720, -60) },
        { id: 'dln_b3', text: 'D’accordo… ratti grossi come cani, là sotto. Ecco la chiave.', position: lineAt(720, 130) },
        { id: 'dln_b4', text: 'Rumori? Solo il vento nelle botti, straniero. Bevi qualcosa.', position: lineAt(720, 320) },
        { id: 'dln_b5', text: 'Quella è mia! …Va bene, tienila. Ma non dirlo a nessuno.', position: lineAt(720, 510) }
      ]
    },
    {
      id: 'dlg_avvertimento',
      npcId: 'npc_bruno',
      title: 'Avvertimento in cantina',
      startLineId: 'dln_a1',
      lines: [{ id: 'dln_a1', text: 'Attento ai gradini, sono scivolosi.', position: lineAt(0, 0) }]
    },
    {
      id: 'dlg_rapporto',
      npcId: 'npc_capitano',
      title: 'Rapporto serale',
      startLineId: 'dln_r1',
      lines: [{ id: 'dln_r1', text: 'I banditi si fanno più audaci ogni notte.', position: lineAt(0, 0) }]
    }
  ],
  flags: [
    { id: 'flg_chiesto_cantina', name: 'chiesto_cantina' },
    { id: 'flg_cantina_visitata', name: 'cantina_visitata' }
  ],
  documents: [
    {
      id: 'doc_note',
      title: 'Note per il master',
      markdown: '# Note per il master\n\n@[Oste Bruno](npc:npc_bruno) sa più di quanto dice sulla @[Cantina infestata](scene:scn_cantina).\n'
    }
  ]
}

export const sampleProject = (): Project => Project.parse(structuredClone(input))
