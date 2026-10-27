'use client'

import type { AriaAttributes } from 'react'
import clsx from 'clsx'
import { DropdownTrigger } from '@mokuren/ui/dropdown-trigger'
import { useSelectHook, type SelectOption } from './select.hook'
import styles from './select.module.css'

type SelectProps<Value extends string> = Pick<
  AriaAttributes,
  'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid'
> & {
  id?: string
  className?: string
  value: Value
  options: readonly SelectOption<Value>[]
  onValueChange: (value: Value) => void
  disabled?: boolean
}

export function Select<Value extends string>({
  id,
  className,
  value,
  options,
  onValueChange,
  disabled,
  ...ariaProps
}: SelectProps<Value>) {
  const {
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
  } = useSelectHook({ value, options, onValueChange })

  return (
    <div ref={rootRef} className={clsx(styles.select, className)} onBlur={handleBlur}>
      <DropdownTrigger
        {...ariaProps}
        ref={triggerRef}
        id={id || generatedId}
        className={styles.trigger}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        disabled={disabled || !options.length}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.value}>{selectedOption?.label}</span>
      </DropdownTrigger>
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          className={styles.list}
          role="listbox"
          aria-label={ariaProps['aria-label']}
          aria-labelledby={
            ariaProps['aria-labelledby'] ||
            (!ariaProps['aria-label'] ? id || generatedId : undefined)
          }
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              className={styles.option}
              onPointerMove={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.value === value && (
                <svg
                  className={styles.check}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m4 10 4 4 8-8" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
