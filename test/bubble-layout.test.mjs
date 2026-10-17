import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBubbleSize, fitBubbleSize } from '../src/bubble-layout.mjs';
import { normalize } from '../src/model.mjs';
test('bubble sizing is compact, bounded and supports tiny monitors', () => {
  assert.ok(initialBubbleSize({kind:'quote'}).height < 170);
  assert.ok(initialBubbleSize({kind:'quota',ok:true}).height < 340);
  assert.deepEqual(fitBubbleSize({width:10000,height:10000},{width:1920,height:1080}),{width:360,height:480});
  assert.deepEqual(fitBubbleSize({width:10,height:10},{width:1920,height:1080}),{width:240,height:112});
  const tiny=fitBubbleSize({width:328,height:480},{width:180,height:160});
  assert.ok(tiny.width<=180 && tiny.height<=160);
});
test('about defaults fill legacy blanks and preserve deliberate custom information', () => {
  const about=normalize({aboutAuthor:'',aboutContact:'',aboutWebsite:''});
  assert.equal(about.aboutAuthor,'琉璃kisaki');
  assert.ok(about.aboutContact.includes('liulikisaki@gmail.com'));
  assert.equal(about.aboutWebsite,'https://github.com/luoluoyihang5-design/Oblivious');
  assert.equal(normalize({aboutAuthor:'自定义'}).aboutAuthor,'自定义');
});
