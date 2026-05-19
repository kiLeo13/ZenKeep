import { useState, type JSX, type ReactNode } from "react"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import clsx from "clsx"

import { FaChevronDown } from "react-icons/fa"
import { FaChevronRight } from "react-icons/fa"
import { Button } from "./buttons/Button"
import { BsCheck } from "react-icons/bs"
import { Ripple } from "./effects/Ripple"
import { useTranslation } from "react-i18next"

import styles from "./MultiSelectMenu.module.css"

type MenuOptionId = string | number

export type MenuOption = {
  id: MenuOptionId
  label: string
  icon?: ReactNode
  info?: string
  disabled?: boolean
}

type MultiSelectMenuProps = {
  label: string
  icon?: ReactNode
  options: MenuOption[]
  values: MenuOptionId[]
  onChange?: (newValues: MenuOptionId[]) => void
  onItemToggle?: (
    option: MenuOption,
    checked: boolean,
    nextValues: MenuOptionId[]
  ) => Promise<void> | void
  onSave?: () => Promise<void> | void
  isLoading?: boolean
  saveDisabled?: boolean
  showFooter?: boolean
  variant?: "dropdown" | "submenu"
  emptyMessage?: string
  saveLabel?: string
}

export function MultiSelectMenu({
  label,
  icon,
  options,
  values,
  onChange,
  onItemToggle,
  onSave,
  isLoading,
  saveDisabled,
  showFooter = true,
  variant = "dropdown",
  emptyMessage,
  saveLabel
}: MultiSelectMenuProps): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<MenuOptionId>>(() => new Set())

  const handleToggle = async (opt: MenuOption) => {
    const id = opt.id
    const newValues = values.includes(id)
      ? values.filter((v) => v !== id)
      : [...values, id]
    const checked = newValues.includes(id)

    if (!onItemToggle) {
      onChange?.(newValues)
      return
    }

    setPendingIds((prev) => new Set(prev).add(id))
    try {
      await onItemToggle(opt, checked, newValues)
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleSave = async () => {
    await onSave?.()
    setOpen(false)
  }

  const content = (
    <>
      <div className={styles.scrollContainer}>
        {options.map((opt) => {
          const isChecked = values.includes(opt.id)
          const isPending = pendingIds.has(opt.id)

          return (
            <DropdownMenu.CheckboxItem
              key={opt.id}
              className={styles.item}
              checked={isChecked}
              disabled={opt.disabled || isPending}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => void handleToggle(opt)}
            >
              <Ripple />
              <div className={styles.labelContainer}>
                {opt.icon && <span className={styles.optIcon}>{opt.icon}</span>}
                <span className={styles.itemLabel}>{opt.label}</span>
              </div>

              <div className={styles.checkbox}>
                <DropdownMenu.ItemIndicator className={styles.indicator}>
                  <BsCheck size={16} strokeWidth={1} />
                </DropdownMenu.ItemIndicator>
              </div>
            </DropdownMenu.CheckboxItem>
          )
        })}

        {options.length === 0 && emptyMessage && (
          <span className={styles.emptyMessage}>{emptyMessage}</span>
        )}
      </div>

      {showFooter && (
        <>
          <DropdownMenu.Separator className={styles.separator} />

          <div className={styles.footer}>
            <Button
              className={styles.saveButton}
              isLoading={isLoading}
              disabled={isLoading || saveDisabled}
              onClick={handleSave}
              loaderProps={{ scale: 0.8 }}
            >
              {saveLabel ?? t("menus.users.perms.saveButton")}
            </Button>
          </div>
        </>
      )}
    </>
  )

  if (variant === "submenu") {
    return (
      <DropdownMenu.Sub open={open} onOpenChange={setOpen}>
        <DropdownMenu.SubTrigger className={styles.subTrigger}>
          <div className={styles.labelContainer}>
            {icon && <span className={styles.optIcon}>{icon}</span>}
            <span className={styles.itemLabel}>{label}</span>
            <FaChevronRight className={styles.subChevron} />
          </div>
        </DropdownMenu.SubTrigger>

        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            className={styles.content}
            sideOffset={8}
            alignOffset={-5}
            style={{ zIndex: 100 }}
          >
            {content}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button className={styles.triggerButton}>
          {label}
          <FaChevronDown
            className={clsx(styles.chevron, open && styles.open)}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          sideOffset={5}
          collisionPadding={5}
          avoidCollisions
          side="left"
          align="start"
        >
          {content}

          <DropdownMenu.Arrow className={styles.arrow} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
