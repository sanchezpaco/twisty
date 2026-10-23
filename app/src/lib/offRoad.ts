/**
 * Tracks wait for the off-road update (ROADMAP, Phase "Off-road"): until then no rider is offered them and the build
 * leaves their layer out. The planner, the ride summary and the pipeline keep tracks working for that update.
 */
export const TRACKS_OFFERED = false

/** A trip saved with tracks is planned on roads while tracks are not offered; its history keeps the flag. */
export const tracksFor = (saved: boolean): boolean => TRACKS_OFFERED && saved
