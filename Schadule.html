<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.1.0/css/bootstrap.min.css">
<style type="text/css">
  body{
    background-color: #a8d8cd;
  }
  .container{
    margin-top:30px;
  }
  .box{
    background-color: aliceblue;
    padding:30px;
    margin-bottom:20px;
  }
  .form-group{
    margin-bottom:20px;
    margin-top:20px;
  }
</style>
<?php
  if(isset($_POST['amount'])){
    $_POST['amount'] = str_replace(',','',$_POST['amount']);
    $emi = PMT($_POST['interest'],$_POST['period'],$_POST['amount']);
    $balance = $_POST['amount'];
    $payment_date = $_POST['start_date'];
  }
?>
<div class="container">
  <h1 class="text-center">Loan EMI Calculator and Schedule Generator</h1>
  <hr>
  <div class="box">
    <h3 class="text-center">Loan Details</h3>
    <hr>
    <form action="" method="post">
      <div class="row">
        <div class="col-6">
          <div class="form-group">
            <label>Loan Amount</label>
            <input type="text" name="amount" class="form-control" value="<?php echo number_format(@$_POST['amount'],0);?>" required>
          </div>
          <div class="form-group">
            <label>Interest (%)</label>
            <input type="text" name="interest" class="form-control" value="<?php echo @$_POST['interest'];?>" required>
          </div>
        </div>
        <div class="col-6">
          <div class="form-group">
            <label>Period (Years)</label>
            <input type="text" name="period" class="form-control" value="<?php echo @$_POST['period'];?>" required>
          </div>
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" name="start_date" value="<?php echo @$_POST['start_date'];?>" class="form-control" required>
          </div>
        </div>
      </div>
      <input type="submit" class="btn btn-primary" value="Calculate">
    </form>
  </div>
  <div class="box">
    <div class="row">
      <div class="col-12">
        <div class="alert alert-info" role="alert">
          Monthly EMI Payment for the loan details amounts to <?php echo showValue($emi);?>
        </div>
        <h3 class="text-center">EMI Schedule</h3>
        <hr>
        <table class="table table-striped table-bordered">
          <thead>
            <tr>
              <th>SN</th>
              <th>Payment Date</th>
              <th>Monthly EMI</th>
              <th>Interest Paid</th>
              <th>Principal Paid</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            <?php for($i=1;$i<=$_POST['period']*12;$i++){?>
              <?php 
                $interest = (($_POST['interest']/100)*$balance)/12;
                $principal = $emi - $interest;
                $balance = $balance - $principal;
                $payment_date = date('Y-m-d',strtotime("+1 month",strtotime($payment_date)));
              ?>
              <tr>
                <td><?php echo $i;?></td>
                <td><?php showDate($payment_date);?></td>
                <td><?php showValue($emi);?></td>
                <td><?php showValue($interest);?></td>
                <td><?php showValue($principal);?></td>
                <td><?php showValue($balance);?></td>
              </tr>
            <?php } ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
