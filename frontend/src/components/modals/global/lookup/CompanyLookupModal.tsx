import { useEffect, useMemo, useRef, useState, type JSX } from "react"
import type { CompanyResponse } from "@/types/api/misc"

import clsx from "clsx"

import { IoMdClose } from "react-icons/io"
import { IoSearchSharp } from "react-icons/io5"
import { FaBuilding } from "react-icons/fa"
import { CNPJInput } from "./CNPJInput"
import { CompanyDisplay } from "./CompanyDisplay"
import { Button } from "@/components/ui/buttons/Button"
import { AppTooltip } from "@/components/ui/AppTooltip"
import { ModalLabel } from "../../notes/shared/sections/ModalLabel"
import { isCNPJValid } from "@/utils/companies/companyValidators"
import { miscService } from "@/services/miscService"
import { useTranslation } from "react-i18next"
import { toasts } from "@/utils/toastUtils"
import { throttle } from "lodash-es"

import styles from "./CompanyLookupModal.module.css"

type CompanyLookupModalProps = {
  setLookingUp: (flag: boolean) => void
}

export function CompanyLookupModal({
  setLookingUp
}: CompanyLookupModalProps): JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement | null>(null)

  const [cnpj, setCnpj] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [company, setCompany] = useState<null | CompanyResponse>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isDisabled = isLoading || !!errorMessage || cnpj.length !== 14

  const handleCloseModal = () => setLookingUp(false)

  const handleCnpjChange = (val: string) => {
    setCnpj(val)
    if (!val) {
      setErrorMessage("")
      return
    }

    if (val.length === 14 && !isCNPJValid(val)) {
      setErrorMessage(t("errors.invalidCnpj"))
    } else {
      setErrorMessage("")
    }
  }

  const handleSend = async (cleanCnpj: string) => {
    if (cleanCnpj === company?.cnpj || cleanCnpj.length != 14) return
    setCompany(null)
    setErrorMessage("")

    setIsLoading(true)
    const resp = await miscService.findByCNPJ(cleanCnpj)
    setIsLoading(false)

    if (resp.success) {
      setCompany(resp.data)
      return
    }

    if (resp.statusCode === 404) {
      setErrorMessage(t("errors.cnpjNotFound"))
      return
    }

    if (resp.statusCode === 400) {
      setErrorMessage(t("errors.invalidCnpj"))
      return
    }
    toasts.apiError(t("errors.cnpjLookup"), resp)
  }

  const handleSendRef = useRef(handleSend)

  useEffect(() => {
    handleSendRef.current = handleSend
  })

  const throttledSend = useMemo(
    () =>
      throttle((cleanCnpj: string) => handleSendRef.current(cleanCnpj), 5000, {
        leading: true,
        trailing: false
      }),
    []
  )

  useEffect(() => {
    return () => throttledSend.cancel()
  }, [throttledSend])

  return (
    <div ref={ref} className={clsx(styles.container, company && styles.found)}>
      <div className={styles.close} onClick={handleCloseModal}>
        <IoMdClose color="#5e4c79" size={"24px"} />
      </div>

      <div className={styles.top}>
        <div className={styles.titleContainer}>
          <FaBuilding className={styles.titleIcon} size={"1.5em"} />
          <h2 className={styles.title}>{t("modals.lookup.title")}</h2>
        </div>

        <header className={styles.header}>
          <ModalLabel
            title={t("modals.lookup.headerLabel")}
            htmlFor="cnpj"
            required
          />
          <div className={styles.inputRow}>
            <CNPJInput
              className={styles.searchBar}
              value={cnpj}
              onChange={handleCnpjChange}
              errorMessage={errorMessage}
              onEnter={throttledSend}
              id="cnpj"
            />
            <AppTooltip label={t("labels.lookup")}>
              <Button
                className={styles.submit}
                isLoading={isLoading}
                loaderProps={{ scale: "0.8" }}
                disabled={isDisabled}
                onClick={() => !errorMessage && throttledSend(cnpj)}
              >
                <IoSearchSharp
                  className={styles.sendIcon}
                  size={"1.4em"}
                  opacity={isLoading ? 0 : 1}
                />
              </Button>
            </AppTooltip>
          </div>
        </header>
      </div>

      {company && <CompanyDisplay company={company} />}
    </div>
  )
}
