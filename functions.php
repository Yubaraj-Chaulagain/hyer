<?php
function PMT($interest,$period,$loan_amount){
  $interest = (float)$interest;
  $period = (float)$period;
  $loan_amount = (float)$loan_amount;
  $period = $period * 12;
  $interest = $interest / 1200;
  $amount = $interest * -$loan_amount * pow((1+$interest),$period) / (1 - pow((1+$interest), $period));
  return $amount;
}
function showValue($value){
  echo number_format($value,2);
}
function showDate($date){
  echo date('jS F, Y',strtotime($date));
}
