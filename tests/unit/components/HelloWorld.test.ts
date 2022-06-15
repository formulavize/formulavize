/**
 * @vitest-environment jsdom
 */
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HelloWorld from '../../../src/components/HelloWorld.vue'

describe('HelloWorld', () => {
  test('should display header text', () => {
    const msg = 'Hello Vue 3'
    const wrapper = mount(HelloWorld, { props: { msg } })

    expect(wrapper.find('h1').text()).toEqual(msg)
  })
})
