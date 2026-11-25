import { it, expect } from 'vitest';
import { updateReleaseSchema } from '../validators/release.js';
import { editTracks, submissionIssues } from './releaseEditing.js';

it('does not accept submission through metadata PATCH', () => {
  expect(updateReleaseSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
});
it('persists edits without replacing the existing track identity or audio', async () => {
  const row={id:'track-one',trackNumber:1,discNumber:1,title:'Before',audioKey:'audio/synthetic.wav'};
  const tx={track:{findMany:async()=>[row],update:async({data})=>Object.assign(row,data)}};
  await editTracks(tx,'release-one',[{title:'After',trackNumber:1,discNumber:1}]);
  expect(row.title).toBe('After');expect(row.id).toBe('track-one');expect(row.audioKey).toBe('audio/synthetic.wav');
});
it('refuses a track id outside the owned release',async()=>{
  const tx={track:{findMany:async()=>[]}};
  await expect(editTracks(tx,'release-one',[{id:'other-track',title:'After',trackNumber:1}])).rejects.toMatchObject({statusCode:400});
});
it('requires cover, audio, contributor rights and lead time on submission',()=>{
  const release={title:'Synthetic',releaseType:'SINGLE',genre:'Pop',releaseDate:new Date('2099-01-01'),tracks:[{title:'Synthetic',trackNumber:1,contributors:[]}]};
  expect(submissionIssues(release,{plan:'FREE'}).length).toBeGreaterThan(0);
  release.coverArtKey='images/cover.png';release.tracks[0].audioKey='audio/synthetic.wav';
  release.tracks[0].contributors=[{name:'Artist',role:'PRIMARY_ARTIST',royaltyPercentage:100}];
  expect(submissionIssues(release,{plan:'FREE'})).toEqual([]);
});
