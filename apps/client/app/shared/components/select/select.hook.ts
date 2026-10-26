'use client'

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

export type SelectOption<Value extends string = string> = {
  value: Value
  label: string
}

type SelectHookProps<Value extends string> = {
  value: Value
  options: readonly SelectOption<Value>[]
  onValueChange: (value: Value) => void
}

export function useSelectHook<Value extends string>({
  value,
  options,
  onValueChange,
}: SelectHookProps<Value>) {
  const generatedId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef({ text: '', time: 0 })
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = options[selectedIndex]
  const listId = `${generatedId}-options`
  const activeOptionId = `${listId}-${activeIndex}`

  const open = (index = Math.max(0, selectedIndex)) => {
    setActiveIndex(index)
    setIsOpen(true)
    searchRef.current = { text: '', time: 0 }
  }

  const toggle = () => {
    if (isOpen) {
      setIsOpen(false)
    } else {
      open()
    }
  }

  const choose = (option: SelectOption<Value>) => {
    onValueChange(option.value)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !options.length) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        open()
      } else {
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((previous) =>
          Math.max(0, Math.min(options.length - 1, previous + direction))
        )
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      open(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (isOpen && options[activeIndex]) {
        choose(options[activeIndex])
      } else {
        open()
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        event.stopPropagation()
        setIsOpen(false)
      }
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    } else if (event.key.length === 1) {
      event.preventDefault()
      const now = Date.now()
      const text =
        (now - searchRef.current.time < 500 ? searchRef.current.text : '') + event.key.toLowerCase()
      searchRef.current = { text, time: now }
      const prefix = [...text].every((character) => character === text[0]) ? text[0] : text
      const start = isOpen ? activeIndex : selectedIndex
      const indices = options.map((_, index) => (Math.max(start, 0) + index + 1) % options.length)
      const match = indices.find((index) => options[index].label.toLowerCase().startsWith(prefix))
      if (match !== undefined) {
        if (isOpen) {
          setActiveIndex(match)
        } else {
          onValueChange(options[match].value)
        }
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, activeIndex])

  return {
    rootRef,
    triggerRef,
    listRef,
    isOpen,
    activeIndex,
    selectedOption,
    listId,
    activeOptionId,
    generatedId,
    toggle,
    choose,
    setActiveIndex,
    handleKeyDown,
    handleBlur,
  }
}
