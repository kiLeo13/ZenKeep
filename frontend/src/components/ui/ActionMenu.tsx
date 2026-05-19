import React, { type JSX } from "react"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import clsx from "clsx"

import { Ripple } from "./effects/Ripple"

import styles from "./ActionMenu.module.css"

export interface MenuActionItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  className?: string
  variant?: "default" | "danger"
  separatorBefore?: boolean
  style?: React.CSSProperties
}

type ActionMenuProps = {
  children: React.ReactNode
  header?: string
  items: MenuActionItem[]
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  isolateEvents?: boolean
  style?: React.CSSProperties
}

export function ActionMenu({
  children,
  header,
  items,
  side = "bottom",
  align = "start",
  isolateEvents = true,
  style
}: ActionMenuProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menuContent}
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={10}
          style={style}
        >
          {header && (
            <>
              <DropdownMenu.Label className={styles.menuLabel}>
                {header}
              </DropdownMenu.Label>
              <DropdownMenu.Separator className={styles.menuSeparator} />
            </>
          )}

          {items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              {item.separatorBefore && (
                <DropdownMenu.Separator className={styles.menuSeparator} />
              )}
              <DropdownMenu.Item
                className={clsx(
                  styles.menuItem,
                  item.variant === "danger" && styles.menuItemDanger,
                  item.className
                )}
                onSelect={item.onClick}
                onClick={isolateEvents ? (e) => e.stopPropagation() : undefined}
                style={item.style}
              >
                <div className={styles.iconWrapper}>{item.icon}</div>
                <span className={styles.itemLabel}>{item.label}</span>
                <Ripple />
              </DropdownMenu.Item>
            </React.Fragment>
          ))}
          <DropdownMenu.Arrow className={styles.menuArrow} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
