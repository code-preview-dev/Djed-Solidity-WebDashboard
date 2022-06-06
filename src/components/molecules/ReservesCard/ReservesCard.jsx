import React from "react";
import CoinIndicator from "../../atoms/CoinIndictor/CoinIndicator";
import NumberItem from "../../atoms/NumberItem/NumberItem";
import "./_ReservesCard.scss";

const ReservesCard = ({
  coinIcon,
  coinName,
  priceAmount,
  equivalence,
  reserveRatio,
  reserveRatioMin,
  reserveRatioMax
}) => (
  <div className="ReservesCard">
    <CoinIndicator coinIcon={coinIcon} coinName={coinName} />
    <hr />
    <div className="Content">
      <div className="BaseReserves">
        <span>Base Reserves</span>
        <h3>{priceAmount} milktADA</h3>
        <p>≈ {equivalence}</p>
      </div>
      <div className="ReservesRatio">
        <NumberItem amount={reserveRatioMin} label="Minimum Reserve Ratio" />
        <NumberItem amount={reserveRatioMax} label="Maximum Reserve Ratio" />
        <NumberItem amount={reserveRatio} label="Current Reserve Ratio" />
      </div>
    </div>
  </div>
);

export default ReservesCard;
