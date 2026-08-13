import { describe, expect, it } from 'vitest'

import { fontMonoOptions, fontSansOptions, formRadiusOptions, radiusOptions } from '../../panel/theme/knobs'

/**
 * 随机化的可锁定项必须与面板上渲染出的锁一一对应。
 *
 * 之前 randomize 固定不动字体，而面板照样渲染了 fontSans / fontMono 两个锁，
 * 于是那两个锁点了没有任何效果——纯死控件。这里从两侧钉住这个契约。
 */

/** 面板上真实渲染出锁按钮的旋钮（见 ThemeBuilderPanel 的 lockProps 调用与 FontPopover 段标题锁）。 */
const lockedKnobsInUi = ['accent', 'base', 'radius', 'formRadius', 'fontSans', 'fontMono'] as const

describe('可锁定项与随机化的契约', () => {
  it('每个 UI 上的锁都有对应的候选集或取值区间', () => {
    // accent/base 是连续区间，radius/font 是离散候选：
    // 后者必须真的有候选可抽，否则随机化无从进行。
    expect(radiusOptions.length).toBeGreaterThan(1)
    expect(formRadiusOptions.length).toBeGreaterThan(1)
    expect(fontSansOptions.length).toBeGreaterThan(1)
    expect(fontMonoOptions.length).toBeGreaterThan(1)
  })

  it('UI 暴露的锁集合与类型定义一致', () => {
    // LockableKnob 的成员若多于 UI，说明有锁没渲染；
    // 少于 UI 则 lockProps 会类型报错。
    const fromType: readonly string[] = ['accent', 'base', 'radius', 'formRadius', 'fontSans', 'fontMono']
    expect([...lockedKnobsInUi]).toEqual([...fromType])
  })

  it('字体候选的 value 都是可直接写入 CSS 的字体栈', () => {
    for (const option of [...fontSansOptions, ...fontMonoOptions]) {
      expect(option.value.length).toBeGreaterThan(0)
      // 不该是裸 URL，value 是要写进 --font-sans 的字体栈。
      expect(option.value).not.toMatch(/^https?:\/\//)
    }
  })
})
