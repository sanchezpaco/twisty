import { resolve } from 'node:path'

/** The pipeline keeps the twisties next to its other intermediate files: the app does not need them at run time. */
export const twistiesFile = () => resolve(process.env.TWISTY_INTERIM ?? '../data/interim', 'twisties.json')
