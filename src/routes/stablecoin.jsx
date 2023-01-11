import React, { useState } from "react";
import MetamaskConnectButton from "../components/molecules/MetamaskConnectButton/MetamaskConnectButton";
import CoinCard from "../components/molecules/CoinCard/CoinCard";
import OperationSelector from "../components/organisms/OperationSelector/OperationSelector";
import ModalTransaction from "../components/organisms/Modals/ModalTransaction";
import ModalPending from "../components/organisms/Modals/ModalPending";
import BuySellButton from "../components/molecules/BuySellButton/BuySellButton";

import "./_CoinSection.scss";
import { useAppProvider } from "../context/AppProvider";
import useBuyOrSell from "../utils/hooks/useBuyOrSell";
import { TRANSACTION_USD_LIMIT, TRANSACTION_VALIDITY } from "../utils/constants";
import {
  getScAdaEquivalent,
  stringToBigNumber,
  validatePositiveNumber
} from "../utils/helpers";
import {
  buyScTx,
  promiseTx,
  sellScTx,
  tradeDataPriceBuySc,
  tradeDataPriceSellSc,
  checkBuyableSc,
  checkSellableSc,
  verifyTx,
  BC_DECIMALS,
  calculateTxFees
} from "../utils/ethereum";
import { BigNumber } from "ethers";

export default function Stablecoin() {
  const {
    web3,
    isWalletConnected,
    isWrongChain,
    coinsDetails,
    djedContract,
    decimals,
    accountDetails,
    coinBudgets,
    accounts,
    systemParams,
    isRatioAboveMin
  } = useAppProvider();
  const { buyOrSell, isBuyActive, setBuyOrSell } = useBuyOrSell();
  const [tradeData, setTradeData] = useState({});
  const [value, setValue] = useState(null);
  const [txError, setTxError] = useState(null);
  const [txStatus, setTxStatus] = useState("idle");
  const [buyValidity, setBuyValidity] = useState(
    TRANSACTION_VALIDITY.WALLET_NOT_CONNECTED
  );
  const [sellValidity, setSellValidity] = useState(
    TRANSACTION_VALIDITY.WALLET_NOT_CONNECTED
  );

  const txStatusPending = txStatus === "pending";
  const txStatusRejected = txStatus === "rejected";
  const txStatusSuccess = txStatus === "success";

  const updateBuyTradeData = (amountScaled) => {
    const inputSanity = validatePositiveNumber(amountScaled);
    if (inputSanity !== TRANSACTION_VALIDITY.OK) {
      setBuyValidity(inputSanity);
      return;
    }
    const getTradeData = async () => {
      try {
        const data = await tradeDataPriceBuySc(
          djedContract,
          decimals.scDecimals,
          amountScaled
        );

        const { f } = calculateTxFees(data.totalUnscaled, systemParams?.feeUnscaled, 0);
        const isRatioAboveMinimum = isRatioAboveMin({
          totalScSupply: BigNumber.from(coinsDetails?.unscaledNumberSc).add(
            BigNumber.from(data.amountUnscaled)
          ),
          scPrice: BigNumber.from(data.priceUnscaled),
          reserveBc: BigNumber.from(coinsDetails?.unscaledReserveBc).add(
            BigNumber.from(data.totalUnscaled).add(f)
          )
        });

        setTradeData(data);
        if (!isWalletConnected) {
          setBuyValidity(TRANSACTION_VALIDITY.WALLET_NOT_CONNECTED);
        } else if (isWrongChain) {
          setBuyValidity(TRANSACTION_VALIDITY.WRONG_NETWORK);
        } else if (amountScaled >= TRANSACTION_USD_LIMIT) {
          setBuyValidity(TRANSACTION_VALIDITY.TRANSACTION_LIMIT_REACHED);
        } else if (
          stringToBigNumber(accountDetails.unscaledBalanceBc, BC_DECIMALS).lt(
            stringToBigNumber(data.totalBCUnscaled, BC_DECIMALS)
          )
        ) {
          setBuyValidity(TRANSACTION_VALIDITY.INSUFFICIENT_BC);
        } else if (!isRatioAboveMinimum) {
          setBuyValidity(TRANSACTION_VALIDITY.RESERVE_RATIO_LOW);
        } else {
          checkBuyableSc(
            djedContract,
            data.amountUnscaled,
            coinBudgets?.unscaledBudgetSc
          ).then((res) => {
            setBuyValidity(res);
          });
        }
      } catch (error) {
        console.log("error", error);
      }
    };
    getTradeData();
  };

  const updateSellTradeData = (amountScaled) => {
    const inputSanity = validatePositiveNumber(amountScaled);
    if (inputSanity !== TRANSACTION_VALIDITY.OK) {
      setSellValidity(inputSanity);
      return;
    }
    const getTradeData = async () => {
      try {
        const data = await tradeDataPriceSellSc(
          djedContract,
          decimals.scDecimals,
          amountScaled
        );
        setTradeData(data);
        if (!isWalletConnected) {
          setSellValidity(TRANSACTION_VALIDITY.WALLET_NOT_CONNECTED);
        } else if (isWrongChain) {
          setSellValidity(TRANSACTION_VALIDITY.WRONG_NETWORK);
        } else if (amountScaled >= TRANSACTION_USD_LIMIT) {
          setSellValidity(TRANSACTION_VALIDITY.TRANSACTION_LIMIT_REACHED);
        } else if (
          stringToBigNumber(accountDetails.unscaledBalanceSc, decimals.scDecimals).lt(
            stringToBigNumber(data.amountUnscaled, decimals.scDecimals)
          )
        ) {
          setSellValidity(TRANSACTION_VALIDITY.INSUFFICIENT_SC);
        } else {
          checkSellableSc(data.amountUnscaled, accountDetails?.unscaledBalanceSc).then(
            (res) => setSellValidity(res)
          );
        }
      } catch (error) {
        console.log("error", error);
      }
    };
    getTradeData();
  };

  const onChangeBuyInput = (amountScaled) => {
    setValue(amountScaled);
    updateBuyTradeData(amountScaled);
  };
  const onChangeSellInput = (amountScaled) => {
    setValue(amountScaled);
    updateSellTradeData(amountScaled);
  };

  const buySc = (total) => {
    console.log("Attempting to buy SC for", total);
    setTxStatus("pending");
    promiseTx(accounts, buyScTx(djedContract, accounts[0], total))
      .then((hash) => {
        verifyTx(web3, hash).then((res) => {
          if (res) {
            console.log("Buy SC success!");
            setTxStatus("success");
          } else {
            console.log("Buy SC reverted!");
            setTxError("The transaction reverted.");
            setTxStatus("rejected");
          }
        });
      })
      .catch((err) => {
        console.error("Buy SC error:", err.message);
        setTxStatus("rejected");
        setTxError("MetaMask error. See developer console for details.");
      });
  };

  const sellSc = (amount) => {
    console.log("Attempting to sell SC in amount", amount);
    setTxStatus("pending");
    promiseTx(accounts, sellScTx(djedContract, accounts[0], amount))
      .then((hash) => {
        verifyTx(web3, hash).then((res) => {
          if (res) {
            console.log("Sell SC success!");
            setTxStatus("success");
          } else {
            console.log("Sell SC reverted!");
            setTxError("The transaction reverted.");
            setTxStatus("rejected");
          }
        });
      })
      .catch((err) => {
        console.error("Sell SC error:", err.message);
        setTxStatus("rejected");
        setTxError("MetaMask error. See developer console for details.");
      });
  };

  const tradeFxn = isBuyActive
    ? buySc.bind(null, tradeData.totalBCUnscaled)
    : sellSc.bind(null, tradeData.amountUnscaled);

  const transactionValidated = isBuyActive
    ? buyValidity === TRANSACTION_VALIDITY.OK
    : sellValidity === TRANSACTION_VALIDITY.OK;

  const buttonDisabled = value === null || isWrongChain || !transactionValidated;

  const scFloat = parseFloat(coinsDetails?.scaledNumberSc.replaceAll(",", ""));
  const scConverted = getScAdaEquivalent(coinsDetails, scFloat);

  return (
    <main style={{ padding: "1rem 0" }}>
      <div className="StablecoinSection">
        <div className="Left">
          <h1>Djed StableCoin {/*<strong>Name</strong>*/}</h1>
          <div className="DescriptionContainer">
            <p>
              Djed StableCoin is the USD-pegged stablecoin which is part of the Djed
              protocol. Each Djed StableCoin is backed by 400-600% collateral of testnet
              milkADA. As such, each Djed StableCoin is able to maintain this peg without
              a centralized monetary policy based on the collateral requirements. This peg
              is automatically maintained with price fluctuations up and until the price
              of ADA dips so low that the collateral value decreases to under 100%.
            </p>
            <p>
              The Djed protocol allows users who own Djed StableCoin to always sell their
              tokens back to the protocol in order to withdraw an equivalent value of
              testnet milkADA. As such, Djed StableCoin is aimed for users who want to
              maintain stability of value in their assets.
            </p>
          </div>
          <CoinCard
            coinIcon="/coin-icon-one.png"
            coinName="Djed StableCoin"
            priceAmount={coinsDetails?.scaledPriceSc} //"0.31152640"
            circulatingAmount={coinsDetails?.scaledNumberSc} //"1,345,402.15"
            tokenName="Djed StableCoin"
            equivalence={scConverted}
          />
        </div>
        <div className="Right">
          <h2 className="SubtTitle">
            <strong>
              Buy <>&amp;</> Sell
            </strong>{" "}
            Djed StableCoin
          </h2>
          <div className="PurchaseContainer">
            <OperationSelector
              coinName="Djed StableCoin"
              selectionCallback={() => {
                setBuyOrSell();
                setValue(null);
                setBuyValidity(TRANSACTION_VALIDITY.ZERO_INPUT);
                setSellValidity(TRANSACTION_VALIDITY.ZERO_INPUT);
              }}
              onChangeBuyInput={onChangeBuyInput}
              onChangeSellInput={onChangeSellInput}
              tradeData={tradeData}
              inputValue={value}
              scaledCoinBalance={accountDetails?.scaledBalanceSc}
              scaledBaseBalance={accountDetails?.scaledBalanceBc}
              fee={systemParams?.fee}
              treasuryFee={systemParams?.treasuryFee}
              buyValidity={buyValidity}
              sellValidity={sellValidity}
              isSellDisabled={Number(coinsDetails?.unscaledNumberSc) === 0}
            />
          </div>
          <div className="ConnectWallet">
            <br />
            {isWalletConnected ? (
              <>
                {/*value != null ? (
                  <p className="Disclaimer">
                    This transaction is expected to{" "}
                    {transactionValidated ? (
                      <strong>succeed.</strong>
                    ) : (
                      <strong>fail!</strong>
                    )}
                  </p>
                    ) : null*/}
                <BuySellButton
                  disabled={buttonDisabled}
                  onClick={tradeFxn}
                  buyOrSell={buyOrSell}
                  currencyName="Djed StableCoin"
                />
              </>
            ) : (
              <>
                <p className="Disclaimer">
                  In order to operate you need to connect your wallet
                </p>
                <MetamaskConnectButton />
              </>
            )}
          </div>
          {txStatusRejected && (
            <ModalTransaction
              transactionType="Failed Transaction"
              transactionStatus="/transaction-failed.svg"
              statusText="Failed transaction!"
              statusDescription={txError}
            />
          )}
          {txStatusPending ? (
            <ModalPending
              transactionType="Confirmation"
              transactionStatus="/transaction-success.svg"
              statusText="Pending for confirmation"
              statusDescription="This transaction can take a while, once the process finish you will see the transaction reflected in your wallet."
            />
          ) : txStatusSuccess ? (
            <ModalTransaction
              transactionType="Success Transaction"
              transactionStatus="/transaction-success.svg"
              statusText="Succesful transaction!"
              statusDescription=""
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
